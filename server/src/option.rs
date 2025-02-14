/*
 * Parseable Server (C) 2022 - 2023 Parseable, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

use clap::error::ErrorKind;
use clap::{command, value_parser, Arg, Args, Command, FromArgMatches};

use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::storage::{
    FSConfig, ObjectStorage, ObjectStorageError, ObjectStorageProvider, S3Config,
    LOCAL_SYNC_INTERVAL,
};
use crate::utils::validate_path_is_writeable;

lazy_static::lazy_static! {
    #[derive(Debug)]
    pub static ref CONFIG: Arc<Config> = Arc::new(Config::new());
}

pub struct Config {
    pub parseable: Server,
    storage: Arc<dyn ObjectStorageProvider + Send + Sync>,
    pub storage_name: &'static str,
}

impl Config {
    fn new() -> Self {
        let cli = parseable_cli_command().get_matches();

        match cli.subcommand() {
            Some(("local-store", m)) => {
                let server = match Server::from_arg_matches(m) {
                    Ok(server) => server,
                    Err(err) => err.exit(),
                };
                let storage = match FSConfig::from_arg_matches(m) {
                    Ok(server) => server,
                    Err(err) => err.exit(),
                };

                if server.local_staging_path == storage.root {
                    parseable_cli_command()
                        .error(
                            ErrorKind::ValueValidation,
                            "Cannot use same path for storage and staging",
                        )
                        .exit()
                }

                Config {
                    parseable: server,
                    storage: Arc::new(storage),
                    storage_name: "drive",
                }
            }
            Some(("s3-store", m)) => {
                let server = match Server::from_arg_matches(m) {
                    Ok(server) => server,
                    Err(err) => err.exit(),
                };
                let storage = match S3Config::from_arg_matches(m) {
                    Ok(server) => server,
                    Err(err) => err.exit(),
                };

                Config {
                    parseable: server,
                    storage: Arc::new(storage),
                    storage_name: "s3",
                }
            }
            _ => unreachable!(),
        }
    }

    pub fn validate(&self) {
        if CONFIG.parseable.upload_interval < LOCAL_SYNC_INTERVAL {
            panic!("object storage upload_interval (P_STORAGE_UPLOAD_INTERVAL) must be 60 seconds or more");
        }
    }

    pub async fn validate_storage(&self, storage: &(impl ObjectStorage + ?Sized)) {
        match storage.check().await {
            Ok(_) => (),
            Err(ObjectStorageError::ConnectionError(inner)) => panic!(
                "Failed to connect to the Object Storage Service on {url}\nCaused by: {cause}",
                url = self.storage().get_endpoint(),
                cause = inner
            ),
            Err(ObjectStorageError::AuthenticationError(inner)) => panic!(
                "Failed to authenticate. Please ensure credentials are valid\n Caused by: {inner}"
            ),
            Err(error) => {
                panic!("{error}")
            }
        }
    }

    pub fn validate_staging(&self) -> anyhow::Result<()> {
        let staging_path = self.staging_dir();
        validate_path_is_writeable(staging_path)
    }

    pub fn storage(&self) -> Arc<dyn ObjectStorageProvider + Send + Sync> {
        self.storage.clone()
    }

    pub fn staging_dir(&self) -> &Path {
        &self.parseable.local_staging_path
    }

    pub fn is_default_creds(&self) -> bool {
        self.parseable.username == Server::DEFAULT_USERNAME
            && self.parseable.password == Server::DEFAULT_PASSWORD
    }
}

impl Default for Config {
    fn default() -> Self {
        Self::new()
    }
}

fn parseable_cli_command() -> Command {
    let local = Server::get_clap_command("local-store");
    let local = <FSConfig as Args>::augment_args_for_update(local);

    let local = local
        .mut_arg(Server::USERNAME, |arg| {
            arg.required(false).default_value(Server::DEFAULT_USERNAME)
        })
        .mut_arg(Server::PASSWORD, |arg| {
            arg.required(false).default_value(Server::DEFAULT_PASSWORD)
        });
    let s3 = Server::get_clap_command("s3-store");
    let s3 = <S3Config as Args>::augment_args_for_update(s3);

    command!()
        .name("Parseable")
        .bin_name("parseable")
        .about("Parseable is a log storage and observability platform.")
        .propagate_version(true)
        .next_line_help(false)
        .help_template(
            r#"
{about} Join the community at https://launchpass.com/parseable.

{all-args}
        "#,
        )
        .subcommand_required(true)
        .subcommands([local, s3])
}

#[derive(Debug, Default)]
pub struct Server {
    /// The location of TLS Cert file
    pub tls_cert_path: Option<PathBuf>,

    /// The location of TLS Private Key file
    pub tls_key_path: Option<PathBuf>,

    /// The address on which the http server will listen.
    pub address: String,

    /// The local staging path is used as a temporary landing point
    /// for incoming events and local cache
    pub local_staging_path: PathBuf,

    /// Interval in seconds after which uncommited data would be
    /// uploaded to the storage platform.
    pub upload_interval: u64,

    /// Username for the basic authentication on the server
    pub username: String,

    /// Password for the basic authentication on the server
    pub password: String,

    /// Server should check for update or not
    pub check_update: bool,
}

impl FromArgMatches for Server {
    fn from_arg_matches(m: &clap::ArgMatches) -> Result<Self, clap::Error> {
        let mut s: Self = Self::default();
        s.update_from_arg_matches(m)?;
        Ok(s)
    }

    fn update_from_arg_matches(&mut self, m: &clap::ArgMatches) -> Result<(), clap::Error> {
        self.tls_cert_path = m.get_one::<PathBuf>(Self::TLS_CERT).cloned();
        self.tls_key_path = m.get_one::<PathBuf>(Self::TLS_KEY).cloned();
        self.address = m
            .get_one::<String>(Self::ADDRESS)
            .cloned()
            .expect("default value for address");
        self.local_staging_path = m
            .get_one::<PathBuf>(Self::STAGING)
            .cloned()
            .expect("default value for staging");
        self.upload_interval = m
            .get_one::<u64>(Self::UPLOAD_INTERVAL)
            .cloned()
            .expect("default value for upload");
        self.username = m
            .get_one::<String>(Self::USERNAME)
            .cloned()
            .expect("default for username");
        self.password = m
            .get_one::<String>(Self::PASSWORD)
            .cloned()
            .expect("default for password");
        self.check_update = m
            .get_one::<bool>(Self::CHECK_UPDATE)
            .cloned()
            .expect("default for check update");

        Ok(())
    }
}

impl Server {
    // identifiers for arguments
    pub const TLS_CERT: &str = "tls-cert-path";
    pub const TLS_KEY: &str = "tls-key-path";
    pub const ADDRESS: &str = "address";
    pub const STAGING: &str = "local-staging-path";
    pub const UPLOAD_INTERVAL: &str = "upload-interval";
    pub const USERNAME: &str = "username";
    pub const PASSWORD: &str = "password";
    pub const CHECK_UPDATE: &str = "check-update";
    pub const DEFAULT_USERNAME: &str = "admin";
    pub const DEFAULT_PASSWORD: &str = "admin";

    pub fn local_stream_data_path(&self, stream_name: &str) -> PathBuf {
        self.local_staging_path.join(stream_name)
    }

    pub fn get_scheme(&self) -> String {
        if self.tls_cert_path.is_some() && self.tls_key_path.is_some() {
            return "https".to_string();
        }

        "http".to_string()
    }

    pub fn get_clap_command(name: &'static str) -> Command {
        Command::new(name).next_line_help(false)
            .arg(
                Arg::new(Self::TLS_CERT)
                    .long(Self::TLS_CERT)
                    .env("P_TLS_CERT_PATH")
                    .value_name("PATH")
                    .value_parser(validation::file_path)
                    .help("The location of TLS Cert file"),
            )
            .arg(
                Arg::new(Self::TLS_KEY)
                    .long(Self::TLS_KEY)
                    .env("P_TLS_KEY_PATH")
                    .value_name("PATH")
                    .value_parser(validation::file_path)
                    .help("The location of TLS Private Key file"),
            )
            .arg(
                Arg::new(Self::ADDRESS)
                    .long(Self::ADDRESS)
                    .env("P_ADDR")
                    .value_name("ADDR:PORT")
                    .default_value("0.0.0.0:8000")
                    .value_parser(validation::socket_addr)
                    .help("The address on which the http server will listen."),
            )
            .arg(
                Arg::new(Self::STAGING)
                    .long(Self::STAGING)
                    .env("P_STAGING_DIR")
                    .value_name("DIR")
                    .default_value("./staging")
                    .value_parser(validation::canonicalize_path)
                    .help("The local staging path is used as a temporary landing point for incoming events and local cache")
                    .next_line_help(true),
            )
            .arg(
                Arg::new(Self::UPLOAD_INTERVAL)
                    .long(Self::UPLOAD_INTERVAL)
                    .env("P_STORAGE_UPLOAD_INTERVAL")
                    .value_name("SECONDS")
                    .default_value("60")
                    .value_parser(value_parser!(u64))
                    .help("Interval in seconds after which un-committed data would be sent to the storage")
                    .next_line_help(true),
            )
            .arg(
                Arg::new(Self::USERNAME)
                    .long(Self::USERNAME)
                    .env("P_USERNAME")
                    .value_name("STRING")
                    .required(true)
                    .help("Username for the basic authentication on the server"),
            )
            .arg(
                Arg::new(Self::PASSWORD)
                    .long(Self::PASSWORD)
                    .env("P_PASSWORD")
                    .value_name("STRING")
                    .required(true)
                    .help("Password for the basic authentication on the server"),
            )
            .arg(
                Arg::new(Self::CHECK_UPDATE)
                    .long(Self::CHECK_UPDATE)
                    .env("P_CHECK_UPDATE")
                    .value_name("BOOL")
                    .required(false)
                    .default_value("true")
                    .value_parser(value_parser!(bool))
                    .help("Password for the basic authentication on the server"),
            )
    }
}

pub mod validation {
    use std::{
        fs::{canonicalize, create_dir_all},
        net::ToSocketAddrs,
        path::PathBuf,
    };

    pub fn file_path(s: &str) -> Result<PathBuf, String> {
        if s.is_empty() {
            return Err("empty path".to_owned());
        }

        let path = PathBuf::from(s);

        if !path.is_file() {
            return Err("path specified does not point to an accessible file".to_string());
        }

        Ok(path)
    }

    pub fn canonicalize_path(s: &str) -> Result<PathBuf, String> {
        let path = PathBuf::from(s);

        create_dir_all(&path)
            .map_err(|err| err.to_string())
            .and_then(|_| {
                canonicalize(&path)
                    .map_err(|_| "Cannot use the path provided as an absolute path".to_string())
            })
    }

    pub fn socket_addr(s: &str) -> Result<String, String> {
        s.to_socket_addrs()
            .is_ok()
            .then_some(s.to_string())
            .ok_or_else(|| "Socket Address for server is invalid".to_string())
    }
}

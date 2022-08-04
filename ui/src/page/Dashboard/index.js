import moment from "moment";
import { useEffect, useState, Fragment, useCallback } from "react";
import Layout from "../../components/Layout";
import SideDialog from "../../components/SideDialog";
import { Listbox, Transition } from "@headlessui/react";
import { SearchIcon } from "@heroicons/react/solid";
import { ChevronDownIcon } from "@heroicons/react/outline";
import { Combobox } from "@headlessui/react";
import { CheckIcon, XCircleIcon, SelectorIcon } from "@heroicons/react/solid";
import BeatLoader from "react-spinners/BeatLoader";
import { getLogStream, queryLogs } from "../../utils/api";
import "./index.css";
import Picker from "./DateTimeRangePicker";
import { useNavigate } from "react-router-dom";

const override = {
  display: "block",
  margin: "0 auto",
  borderColor: "red",
};

function hasSubArray(master, sub) {
  return sub.every(
    (
      (i) => (v) =>
        (i = master.indexOf(v, i) + 1)
    )(0),
  );
}
const Dashboard = () => {
  const [open, setOpen] = useState(false);
  const [clickedRow, setClickedRow] = useState({});
  const [timeZone, setTimeZone] = useState("UTC");
  const [logStreams, setLogStreams] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [stream, setStream] = useState({});
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [labelSelected, setLabelSelected] = useState([]);
  const [filteredStreams, setFilteredStreams] = useState([]);
  const [searchSelected, setSearchSelected] = useState({});
  const [startTime, setStartTime] = useState(
    moment()
      .utcOffset("+00:00")
      .subtract(10, "minutes")
      .format("YYYY-MM-DDThh:mm:ssZ"),
  );

  const [endTime, setEndTime] = useState(
    moment().utcOffset("+00:00").format("YYYY-MM-DDTHH:mm:ssZ"),
  );

  const navigate = useNavigate();

  const selectStreamHandler = useCallback(async () => {
    setLabelSelected([]);
    setSearchSelected({});
    setTableLoading(true);
    const res = await queryLogs(stream.name, startTime, endTime);
    setTableLoading(false);
    setData(res.data);
  }, [stream, startTime, endTime]);

  useEffect(() => {
    stream.name && selectStreamHandler();
  }, [startTime, endTime, stream, selectStreamHandler]);

  useEffect(() => {
    if (!localStorage.getItem("auth")) {
      navigate("/");
    }
    const getStreams = async () => {
      try {
        const res = await getLogStream();
        if (res.data.length > 0) {
          setLogStreams(res.data.sort());
          setStream(res.data.sort()[0]);
          setTableLoading(false);
        }
      } catch (e) {
        if (e.status === 401) {
          navigate("/");
        }
      }
    };
    setTableLoading(true);
    getStreams();
  }, []);

  const timeZoneChange = (e) => {
    setTimeZone(e.target.value);
  };

  useEffect(() => {
    if (query === "") {
      setFilteredStreams(logStreams);
    } else {
      setFilteredStreams(
        logStreams.filter((stream) =>
          stream.name
            .toLowerCase()
            .replace(/\s+/g, "")
            .includes(query.toLowerCase().replace(/\s+/g, "")),
        ),
      );
    }
  }, [logStreams, query]);

  const filteredSTreamStreams =
    searchQuery === ""
      ? data
      : data.filter((data) =>
          data.log
            .toLowerCase()
            .replace(/\s+/g, "")
            .includes(searchQuery.toLowerCase().replace(/\s+/g, "")),
        );

  const clearLabel = (label) => {
    const labelArray = labelSelected;
    const filteredArray = [...labelArray.filter((item) => item !== label)];
    setLabelSelected(filteredArray);
  };

  return (
    <>
      <Layout labels={data.length > 0 && data[0]?.labels}>
        <div className="bg-white shadow">
          <div className="sticky top-0 flex-shrink-0 flex h-24 items-center  ">
            <div className="flex-1 px-4 flex justify-">
              <div className="flex- flex">
                <div>
                  <label
                    htmlFor="location"
                    className="block text-xs text-gray-700"
                  >
                    Stream
                  </label>
                  <Combobox
                    value={stream}
                    onChange={(e) => {
                      setStream(e);
                    }}
                  >
                    <div className="relative mt-1">
                      <Combobox.Input
                        className="custom-input custom-focus"
                        displayValue={(stream) => stream.name}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                      <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                        <SelectorIcon
                          className="h-5 w-5 text-gray-400"
                          aria-hidden="true"
                        />
                      </Combobox.Button>
                      <Transition
                        as={Fragment}
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                        afterLeave={() => setQuery("")}
                      >
                        <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                          {filteredStreams.length === 0 && query !== "" ? (
                            <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                              Nothing found.
                            </div>
                          ) : (
                            filteredStreams.map((stream, index) => (
                              <Combobox.Option
                                key={index}
                                className={({ active }) =>
                                  `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                    active
                                      ? "bg-bluePrimary text-white"
                                      : "text-gray-900"
                                  }`
                                }
                                value={stream}
                              >
                                {({ selected, active }) => (
                                  <>
                                    <span
                                      className={`block truncate ${
                                        selected ? "font-medium" : "font-normal"
                                      }`}
                                    >
                                      {stream.name}
                                    </span>
                                    {selected ? (
                                      <span
                                        className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                          active
                                            ? "text-white"
                                            : "text-bluePrimary"
                                        }`}
                                      >
                                        <CheckIcon
                                          className="h-5 w-5"
                                          aria-hidden="true"
                                        />
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </Combobox.Option>
                            ))
                          )}
                        </Combobox.Options>
                      </Transition>
                    </div>
                  </Combobox>
                </div>
              </div>
              <div>
                <label
                  htmlFor="location"
                  className="block text-xs ml-3 text-gray-700"
                >
                  Search
                </label>
                <div className="flex items-center ml-3">
                  <Picker
                    setStartChange={setStartTime}
                    setEndChange={setEndTime}
                  />
                  <Combobox
                    value={searchSelected}
                    onChange={(e) => {
                      setSearchSelected(e);
                      setSearchOpen(true);
                    }}
                  >
                    <div className="relative mt-1">
                      <div className="relative cursor-default w-96">
                        <Combobox.Input
                          className="search-input custom-focus placeholder-iconGrey"
                          // displayValue={(data) => 'Search'}
                          placeholder="Search"
                          onChange={(event) =>
                            setSearchQuery(event.target.value)
                          }
                        />
                        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                          <SearchIcon
                            className="h-5 w-5 text-iconGrey"
                            aria-hidden="true"
                          />
                        </Combobox.Button>
                      </div>
                      <Transition
                        as={Fragment}
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                        afterLeave={() => setSearchQuery("")}
                      >
                        <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                          {filteredSTreamStreams.length === 0 &&
                          searchQuery !== "" ? (
                            <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                              Nothing found.
                            </div>
                          ) : (
                            filteredSTreamStreams?.map &&
                            filteredSTreamStreams?.map((data, index) => (
                              <Combobox.Option
                                key={index}
                                className={({ active }) =>
                                  `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                    active
                                      ? "bg-bluePrimary text-white"
                                      : "text-gray-900"
                                  }`
                                }
                                value={data}
                              >
                                {({ selected, active }) => (
                                  <>
                                    <span
                                      className={`block truncate ${
                                        selected ? "font-medium" : "font-normal"
                                      }`}
                                    >
                                      {data.log}
                                    </span>
                                    {selected ? (
                                      <span
                                        className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                          active
                                            ? "text-white"
                                            : "text-bluePrimary"
                                        }`}
                                      >
                                        <CheckIcon
                                          className="h-5 w-5"
                                          aria-hidden="true"
                                        />
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </Combobox.Option>
                            ))
                          )}
                        </Combobox.Options>
                      </Transition>
                    </div>
                  </Combobox>
                </div>
              </div>

              <div className="ml-3 flex-1">
                <label
                  htmlFor="location"
                  className="block text-xs text-gray-700"
                >
                  Tag filters
                </label>
                <Listbox
                  value={labelSelected}
                  onChange={setLabelSelected}
                  multiple
                >
                  <div className="relative w-full mt-1">
                    <Listbox.Button className="custom-input flex text-left custom-focus">
                      {labelSelected.length > 0
                        ? labelSelected.map((label) => (
                            <span className="relative block w-min py-px pl-1 pr-6 truncate ml-1 bg-slate-200 rounded-md">
                              {label}
                              <XCircleIcon
                                onClick={() => clearLabel(label)}
                                className="hover:text-gray-600 transform duration-200 text-gray-700 w-4 absolute top-1 right-1"
                              />
                            </span>
                          ))
                        : "Select Tags"}
                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronDownIcon
                          className="h-5 w-5 text-gray-400"
                          aria-hidden="true"
                        />
                      </span>
                    </Listbox.Button>
                    <Transition
                      as={Fragment}
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto grid grid-cols-2 bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        {Object.keys(data).length !== 0 ? (
                          data[0]?.labels
                            ?.split(",")
                            .map((person, personIdx) => (
                              <Listbox.Option
                                key={personIdx}
                                className={({ active }) =>
                                  `relative cursor-default select-none py-2 px-2 ${
                                    active
                                      ? "bg-bluePrimary text-white"
                                      : "text-gray-900"
                                  }`
                                }
                                value={person}
                              >
                                {({ selected }) => (
                                  <>
                                    <span
                                      className={`flex items-center truncate ${
                                        selected ? "font-medium" : "font-normal"
                                      }`}
                                    >
                                      {selected ? (
                                        <div className="w-4 h-4 mr-1 flex items-center justify-center bg-white rounded-sm border-2 border-bluePrimary">
                                          <CheckIcon className="w-3 h-3 font-bold text-bluePrimary" />
                                        </div>
                                      ) : (
                                        <div className="w-4 h-4 mr-1 bg-white rounded-sm border-2 border-gray-400"></div>
                                      )}
                                      {person}
                                    </span>
                                  </>
                                )}
                              </Listbox.Option>
                            ))
                        ) : (
                          <Listbox.Option>Nothing Found</Listbox.Option>
                        )}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </Listbox>
              </div>
            </div>
          </div>

          {/* <DatetimeRangePicker onChange={(e) => console.log('skhd',e)} /> */}

          {/* <div className="w-44">
              <AdvanceDateTimePicker />
            </div> */}

          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg"></div>
              <table className="min-w-full divide-y divide-gray-300">
                <thead className=" bg-gray-200">
                  <tr>
                    <th
                      scope="col"
                      className="py-2 flex items-center justify-between  space-x-2 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                    >
                      <div>Time</div>

                      <select
                        id="time"
                        name="time"
                        className="mt-1 block pl-3 pr-10 py-1 text-base  bg-gray-200 border-gray-300 focus:outline-none sm:text-sm rounded-md"
                        defaultValue={timeZone}
                        onChange={(e) => timeZoneChange(e)}
                      >
                        <option value="UTC">UTC</option>
                        {/* <option value="GMT">GMT</option> */}
                        <option value="IST">IST</option>
                      </select>
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 w-full text-left text-sm font-semibold text-gray-900"
                    >
                      Log
                    </th>
                    <th
                      scope="col"
                      className="hidden lg:block px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Tags
                    </th>
                    <th
                      scope="col"
                      className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                    >
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                {tableLoading ? (
                  <tbody>
                    <tr align={"center"}>
                      <td></td>
                      <td className=" flex py-3 justify-center">
                        <BeatLoader
                          color={"#1A237E"}
                          loading={tableLoading}
                          cssOverride={override}
                          size={10}
                        />
                        <td></td>
                      </td>
                    </tr>
                  </tbody>
                ) : (
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {data.map &&
                      data?.map(
                        (data, index) =>
                          hasSubArray(
                            data.labels?.split(","),
                            labelSelected,
                          ) && (
                            <tr
                              onClick={() => {
                                setOpen(true);
                                setClickedRow(data);
                              }}
                              className="cursor-pointer hover:bg-slate-100 hover:shadow"
                              key={index}
                            >
                              <td className="whitespace-nowrap py-5 pl-4 pr-3 text-xs md:text-sm font-medium text-gray-900 sm:pl-6">
                                {timeZone === "UTC" || timeZone === "GMT"
                                  ? moment
                                      .utc(data.time)
                                      .format("DD/MM/YYYY, HH:mm:ss")
                                  : moment(data.time)
                                      .utcOffset("+05:30")
                                      .format("DD/MM/YYYY, HH:mm:ss")}
                              </td>
                              <td className="truncate text-ellipsis overflow-hidden max-w-200 sm:max-w-xs md:max-w-sm lg:max-w-sm  xl:max-w-md px-3 py-4 text-xs md:text-sm text-gray-700">
                                {data.log}
                              </td>
                              <td className="hidden xl:flex  whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                                {data.labels
                                  ?.split(",")
                                  .filter((tag, index) => index <= 2)
                                  .map((tag, index) => (
                                    <div className="mx-1  bg-slate-200 rounded-sm flex justify-center items-center px-1 py-1">
                                      {tag}
                                    </div>
                                  ))}
                              </td>
                              <td className="hidden lg:flex xl:hidden whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                                {data.labels
                                  ?.split(",")
                                  .filter((tag, index) => index <= 1)
                                  .map((tag, index) => (
                                    <div className="mx-1  bg-slate-200 rounded-sm flex justify-center items-center px-1 py-1">
                                      {tag}
                                    </div>
                                  ))}
                              </td>
                            </tr>
                          ),
                      )}
                  </tbody>
                )}
              </table>
            </div>
          </div>
        </div>

        {Object.keys(searchSelected).length !== 0 && (
          <SideDialog
            open={searchOpen}
            setOpen={setSearchOpen}
            data={searchSelected}
          />
        )}

        <SideDialog open={open} setOpen={setOpen} data={clickedRow} />
      </Layout>
    </>
  );
};

export default Dashboard;
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { getCurrentlyActiveWorkspace } from "store/features/teams/selectors";
import { getUserAuthDetails } from "store/slices/global/user/selectors";
import { RQAPI } from "../types";
import { getApiRecord, getApiRecords, upsertApiRecord } from "backend/apiClient";
import Logger from "lib/logger";
import { addToHistoryInStore, clearHistoryFromStore, getHistoryFromStore } from "../screens/apiClient/historyStore";
import {
  trackHistoryCleared,
  trackImportCurlClicked,
  trackNewRequestClicked,
} from "modules/analytics/events/features/apiClient";
import { useNavigate, useParams } from "react-router-dom";
import { redirectToRequest } from "utils/RedirectionUtils";
import { getEmptyAPIEntry } from "../screens/apiClient/utils";

interface ApiClientContextInterface {
  apiClientRecords: RQAPI.Record[];
  isLoadingApiClientRecords: boolean;
  onNewRecord: (apiClientRecord: RQAPI.Record) => void;
  onRemoveRecord: (apiClientRecord: RQAPI.Record) => void;
  onUpdateRecord: (apiClientRecord: RQAPI.Record) => void;
  onSaveRecord: (apiClientRecord: RQAPI.Record) => void;
  onDeleteRecords: (ids: RQAPI.Record["id"][]) => void;
  recordToBeDeleted: RQAPI.Record;
  updateRecordToBeDeleted: (apiClientRecord: RQAPI.Record) => void;
  isDeleteModalOpen: boolean;
  setIsDeleteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onDeleteModalClose: () => void;
  history: RQAPI.Entry[];
  addToHistory: (apiEntry: RQAPI.Entry) => void;
  clearHistory: () => void;

  isLoading: boolean;
  selectedEntry: RQAPI.Entry;
  selectedEntryDetails: RQAPI.ApiRecord;
  isImportModalOpen: boolean;

  onSelectionFromHistory: (index: number) => void;
  saveRequest: (apiEntry: RQAPI.Entry) => Promise<void>;
  handleImportRequest: (request: RQAPI.Request) => Promise<void>;
  onImportClick: () => void;
  onImportRequestModalClose: () => void;
  onNewClick: (analyticEventSource: RQAPI.AnalyticsEventSource, recordType?: RQAPI.RecordType) => void;
}

const ApiClientContext = createContext<ApiClientContextInterface>({
  apiClientRecords: [],
  isLoadingApiClientRecords: false,
  onNewRecord: (apiClientRecord: RQAPI.Record) => {},
  onRemoveRecord: (apiClientRecord: RQAPI.Record) => {},
  onUpdateRecord: (apiClientRecord: RQAPI.Record) => {},
  onSaveRecord: (apiClientRecord: RQAPI.Record) => {},
  onDeleteRecords: (ids: RQAPI.Record["id"][]) => {},
  recordToBeDeleted: null,
  updateRecordToBeDeleted: (apiClientRecord: RQAPI.Record) => {},
  isDeleteModalOpen: false,
  setIsDeleteModalOpen: () => {},
  onDeleteModalClose: () => {},
  history: [],
  addToHistory: (apiEntry: RQAPI.Entry) => {},
  clearHistory: () => {},

  isLoading: false,
  isImportModalOpen: false,
  selectedEntry: undefined,
  selectedEntryDetails: undefined,

  onSelectionFromHistory: (index: number) => {},
  saveRequest: async (apiEntry: RQAPI.Entry) => {},
  handleImportRequest: async (request: RQAPI.Request) => {},
  onImportClick: () => {},
  onImportRequestModalClose: () => {},
  onNewClick: (analyticEventSource: RQAPI.AnalyticsEventSource) => {},
});

interface ApiClientProviderProps {
  children: React.ReactElement;
}

export const ApiClientProvider: React.FC<ApiClientProviderProps> = ({ children }) => {
  const { requestId } = useParams();
  const navigate = useNavigate();

  const user = useSelector(getUserAuthDetails);
  const uid = user?.details?.profile?.uid;
  const workspace = useSelector(getCurrentlyActiveWorkspace);
  const teamId = workspace?.id;

  const [isLoadingApiClientRecords, setIsLoadingApiClientRecords] = useState(false);
  const [apiClientRecords, setApiClientRecords] = useState<RQAPI.Record[]>([]);
  const [recordToBeDeleted, setRecordToBeDeleted] = useState<RQAPI.Record>();
  const [history, setHistory] = useState<RQAPI.Entry[]>(getHistoryFromStore());

  const [isLoading, setIsLoading] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [selectedEntry, setSelectedEntry] = useState<RQAPI.Entry>();
  const [selectedEntryDetails, setSelectedEntryDetails] = useState<RQAPI.ApiRecord>();

  useEffect(() => {
    if (!requestId || requestId === "new") {
      return;
    }

    setSelectedEntry(null);
    setIsLoading(true);

    getApiRecord(requestId)
      .then((result) => {
        if (result.success) {
          if (result.data.type === RQAPI.RecordType.API) {
            setSelectedEntryDetails(result.data);
          }
        }
      })
      .catch((error) => {
        setSelectedEntryDetails(null);
        // TODO: redirect to new empty entry
        Logger.error("Error loading api record", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [requestId]);

  useEffect(() => {
    if (!user.loggedIn) {
      setApiClientRecords([]);
    }
  }, [user.loggedIn]);

  // TODO: Create modal context
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (!uid) {
      return;
    }

    setIsLoadingApiClientRecords(true);
    getApiRecords(uid, teamId)
      .then((result) => {
        if (result.success) {
          setApiClientRecords(result.data);
        }
      })
      .catch((error) => {
        setApiClientRecords([]);
        Logger.error("Error loading api records!", error);
      })
      .finally(() => {
        setIsLoadingApiClientRecords(false);
      });
  }, [uid, teamId]);

  const onNewRecord = useCallback((apiClientRecord: RQAPI.Record) => {
    setApiClientRecords((prev) => {
      return [...prev, { ...apiClientRecord }];
    });
  }, []);

  const onRemoveRecord = useCallback((apiClientRecord: RQAPI.Record) => {
    setApiClientRecords((prev) => {
      return prev.filter((record) => record.id !== apiClientRecord.id);
    });
  }, []);

  const onUpdateRecord = useCallback((apiClientRecord: RQAPI.Record) => {
    setApiClientRecords((prev) => {
      return prev.map((record) => (record.id === apiClientRecord.id ? { ...record, ...apiClientRecord } : record));
    });
  }, []);

  const onDeleteRecords = useCallback((recordIdsToBeDeleted: RQAPI.Record["id"][]) => {
    setApiClientRecords((prev) => {
      return prev.filter((record) => {
        return !recordIdsToBeDeleted.includes(record.id);
      });
    });
  }, []);

  const onSaveRecord = useCallback(
    (apiClientRecord: RQAPI.Record) => {
      const isRecordExist = apiClientRecords.find((record) => record.id === apiClientRecord.id);

      if (isRecordExist) {
        onUpdateRecord(apiClientRecord);
      } else {
        onNewRecord(apiClientRecord);
      }
    },
    [apiClientRecords, onUpdateRecord, onNewRecord]
  );

  const updateRecordToBeDeleted = useCallback((record: RQAPI.Record) => {
    setRecordToBeDeleted(record);
  }, []);

  const onDeleteModalClose = useCallback(() => {
    setIsDeleteModalOpen(false);
    setRecordToBeDeleted(null);
  }, []);

  const addToHistory = useCallback((apiEntry: RQAPI.Entry) => {
    setHistory((history) => [...history, apiEntry]);
    addToHistoryInStore(apiEntry);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    clearHistoryFromStore();
    trackHistoryCleared();
  }, []);

  const onSelectionFromHistory = useCallback(
    (index: number) => {
      setSelectedEntry(history[index]);
    },
    [history]
  );

  const saveRequest = useCallback(
    async (apiEntry: RQAPI.Entry) => {
      if (!user?.loggedIn) {
        return;
      }

      setIsLoading(true);

      const record: Partial<RQAPI.ApiRecord> = {
        type: RQAPI.RecordType.API,
        data: apiEntry,
      };

      const result = await upsertApiRecord(uid, record, teamId);

      if (result.success) {
        onSaveRecord(result.data);
        redirectToRequest(navigate, result.data.id);
      }

      setIsLoading(false);
    },
    [uid, user?.loggedIn, teamId, onSaveRecord, navigate]
  );

  const handleImportRequest = useCallback(
    async (request: RQAPI.Request) => {
      const apiEntry = getEmptyAPIEntry(request);

      return saveRequest(apiEntry)
        .then(() => {
          setSelectedEntry(apiEntry);
        })
        .finally(() => {
          setIsImportModalOpen(false);
        });
    },
    [saveRequest]
  );

  const onImportClick = useCallback(() => {
    setIsImportModalOpen(true);
    trackImportCurlClicked();
  }, []);

  const onImportRequestModalClose = useCallback(() => setIsImportModalOpen(false), []);

  const onNewClick = useCallback((analyticEventSource: RQAPI.AnalyticsEventSource) => {
    setSelectedEntry(getEmptyAPIEntry());
    setSelectedEntryDetails(null);
    trackNewRequestClicked(analyticEventSource);
  }, []);

  const value = {
    apiClientRecords,
    isLoadingApiClientRecords,
    onNewRecord,
    onRemoveRecord,
    onUpdateRecord,
    onSaveRecord,
    onDeleteRecords,
    recordToBeDeleted,
    updateRecordToBeDeleted,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    onDeleteModalClose,
    history,
    addToHistory,
    clearHistory,

    isLoading,
    isImportModalOpen,
    selectedEntry,
    selectedEntryDetails,

    onSelectionFromHistory,
    saveRequest,
    handleImportRequest,
    onImportClick,
    onImportRequestModalClose,
    onNewClick,
  };

  return <ApiClientContext.Provider value={value}>{children}</ApiClientContext.Provider>;
};

export const useApiClientContext = () => useContext(ApiClientContext);

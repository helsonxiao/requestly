import React, { useCallback, useMemo, useState } from "react";
import { RQAPI } from "features/apiClient/types";
import { Typography } from "antd";
import { useApiClientContext } from "features/apiClient/contexts";
import { NewRecordNameInput } from "./newRecordNameInput/NewRecordNameInput";
import { CollectionRow } from "./collectionRow/CollectionRow";
import { RequestRow } from "./requestRow/RequestRow";
import { convertFlatRecordsToNestedRecords, isApiCollection, isApiRequest } from "../../../../utils";
import { ApiRecordEmptyState } from "./apiRecordEmptyState/ApiRecordEmptyState";
import { ExportCollectionsModal } from "../../../modals/exportCollectionsModal/ExportCollectionsModal";
import { trackExportCollectionsClicked } from "modules/analytics/events/features/apiClient";
import "./collectionsList.scss";

interface Props {
  onNewClick: (src: RQAPI.AnalyticsEventSource) => void;
  recordTypeToBeCreated: RQAPI.RecordType;
  isNewRecordNameInputVisible: boolean;
  hideNewRecordNameInput: () => void;
}

export const CollectionsList: React.FC<Props> = ({
  onNewClick,
  recordTypeToBeCreated,
  isNewRecordNameInputVisible,
  hideNewRecordNameInput,
}) => {
  const { isLoadingApiClientRecords, apiClientRecords } = useApiClientContext();
  const [collectionsToExport, setCollectionsToExport] = useState<RQAPI.CollectionRecord[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const prepareRecordsToRender = useCallback((records: RQAPI.Record[]) => {
    const updatedRecords = convertFlatRecordsToNestedRecords(records);

    updatedRecords.sort((recordA, recordB) => {
      // If different type, then keep collection first
      if (recordA.type !== recordB.type) {
        return recordA.type === RQAPI.RecordType.COLLECTION ? -1 : 1;
      }

      // If types are the same, sort by creation date
      return recordA.createdTs - recordB.createdTs;
    });

    return {
      count: updatedRecords.length,
      collections: updatedRecords.filter((record) => isApiCollection(record)) as RQAPI.CollectionRecord[],
      requests: updatedRecords.filter((record) => isApiRequest(record)) as RQAPI.ApiRecord[],
    };
  }, []);

  const updatedRecords = useMemo(() => prepareRecordsToRender(apiClientRecords), [
    apiClientRecords,
    prepareRecordsToRender,
  ]);

  const handleExportCollection = useCallback((collection: RQAPI.CollectionRecord) => {
    setCollectionsToExport((prev) => [...prev, collection]);
    trackExportCollectionsClicked();
    setIsExportModalOpen(true);
  }, []);

  return (
    <>
      <div className="collections-list-container">
        <div className="collections-list-content">
          {isLoadingApiClientRecords ? (
            <div className="api-client-sidebar-placeholder">
              <Typography.Text type="secondary">Loading...</Typography.Text>
            </div>
          ) : updatedRecords.count > 0 || isNewRecordNameInputVisible ? (
            <div className="collections-list">
              {updatedRecords.collections.map((record) => {
                return (
                  <CollectionRow
                    key={record.id}
                    record={record}
                    onNewClick={onNewClick}
                    onExportClick={handleExportCollection}
                  />
                );
              })}

              {isNewRecordNameInputVisible && recordTypeToBeCreated === RQAPI.RecordType.COLLECTION ? (
                <NewRecordNameInput
                  recordType={RQAPI.RecordType.COLLECTION}
                  analyticEventSource="api_client_sidebar_header"
                  onSuccess={() => hideNewRecordNameInput()}
                />
              ) : null}

              {updatedRecords.requests.map((record) => {
                return <RequestRow key={record.id} record={record} />;
              })}

              {isNewRecordNameInputVisible && recordTypeToBeCreated === RQAPI.RecordType.API ? (
                <NewRecordNameInput
                  recordType={RQAPI.RecordType.API}
                  analyticEventSource="api_client_sidebar_header"
                  onSuccess={() => hideNewRecordNameInput()}
                />
              ) : null}
            </div>
          ) : (
            <ApiRecordEmptyState
              newRecordBtnText="New collection"
              message="No collections created yet"
              onNewRecordClick={() => onNewClick("collection_list_empty_state")}
              recordType={RQAPI.RecordType.COLLECTION}
              analyticEventSource="collection_list_empty_state"
            />
          )}
        </div>
      </div>
      {isExportModalOpen && (
        <ExportCollectionsModal
          collections={collectionsToExport}
          isOpen={isExportModalOpen}
          onClose={() => {
            setCollectionsToExport([]);
            setIsExportModalOpen(false);
          }}
        />
      )}
    </>
  );
};

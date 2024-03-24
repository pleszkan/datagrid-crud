/* eslint-disable no-underscore-dangle */
import * as React from 'react';
import {
    DataGrid,
    GridRowId,
    GridValidRowModel,
    DataGridProps,
    useGridApiRef,
    GridActionsCellItem,
    GridColDef, GridRowsProp, GridRenderCellParams, GridRowModesModel,
} from '@mui/x-data-grid';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import LoadingButton from '@mui/lab/LoadingButton';
import SaveIcon from '@mui/icons-material/Save';
import {darken} from '@mui/material/styles';
import {useState} from "react";
const initialRows: GridRowsProp = [
        {id: '1', name: 'John Doe', age: 50},
        {id: '2', name: 'Jane Doe', age: 25},
    ]
export default function BulkEditingNoSnap() {
    const [rows] = useState(initialRows);
    const [rowModesModel, setRowModesModel] = React.useState<GridRowModesModel>({});

    const dataColumns: GridColDef[] = [
        {field: 'name', headerName: 'Name', editable: true, width: 180},
        {
            field: 'age',
            headerName: 'Age',
            editable: true,
            type: 'number',
            renderCell: (props: GridRenderCellParams) => <span style={{color: 'red'}}>{props.value}</span>,
            width: 180,
            headerAlign: 'left',
            align: 'left'
        },
    ]

    const apiRef = useGridApiRef();

    const unsavedChangesRef = React.useRef<{
        unsavedRows: Record<GridRowId, GridValidRowModel>;
        rowsBeforeChange: Record<GridRowId, GridValidRowModel>;
    }>({
        unsavedRows: {},
        rowsBeforeChange: {},
    });
    const [isSaving, setIsSaving] = React.useState(false);
    console.log(`Unsaved: ${JSON.stringify(unsavedChangesRef.current.unsavedRows)}`)
    console.log(`RowsBeforeChange: ${JSON.stringify(unsavedChangesRef.current.rowsBeforeChange)}`)

    const columns = React.useMemo<GridColDef[]>(() => {
        return [
            {
                field: 'actions',
                type: 'actions',
                getActions: ({id, row}) => {
                    return [
                        <GridActionsCellItem
                            icon={<RestoreIcon/>}
                            label="Discard changes"
                            disabled={unsavedChangesRef.current.unsavedRows[id] === undefined}
                            onClick={() => {
                                apiRef.current.updateRows([
                                    unsavedChangesRef.current.rowsBeforeChange[id],
                                ]);
                                delete unsavedChangesRef.current.rowsBeforeChange[id];
                                delete unsavedChangesRef.current.unsavedRows[id];
                            }}
                        />,
                        <GridActionsCellItem
                            icon={<DeleteIcon/>}
                            label="Delete"
                            onClick={() => {
                                if (!unsavedChangesRef.current.rowsBeforeChange[id]) {
                                    unsavedChangesRef.current.rowsBeforeChange[id] = row;
                                    unsavedChangesRef.current.unsavedRows[id] = {
                                        ...row,
                                        _action: 'delete',
                                    };
                                    apiRef.current.updateRows([row]); // to trigger row render
                                } else if (unsavedChangesRef.current.rowsBeforeChange[id]._action === 'delete') {
                                    delete unsavedChangesRef.current.unsavedRows[id];
                                    apiRef.current.updateRows([unsavedChangesRef.current.rowsBeforeChange[id]])
                                    delete unsavedChangesRef.current.rowsBeforeChange[id];
                                }
                            }}
                        />,
                    ];
                },
            },
            ...dataColumns,
        ];
    }, [dataColumns, unsavedChangesRef, apiRef]);

    const processRowUpdate: NonNullable<DataGridProps['processRowUpdate']> = (
        newRow,
        oldRow,
    ) => {
        const rowId = newRow.id;

        unsavedChangesRef.current.unsavedRows[rowId] = newRow;
        if (!unsavedChangesRef.current.rowsBeforeChange[rowId]) {
            unsavedChangesRef.current.rowsBeforeChange[rowId] = oldRow;
        }
        return newRow;
    };

    const addNewRow = () => {
        const id = `newRow#${new Date().getTime()}`;
        const newRow = {id}
        unsavedChangesRef.current.rowsBeforeChange[newRow.id] = {...newRow, _action: 'delete'}
        unsavedChangesRef.current.unsavedRows[newRow.id] = newRow;
        apiRef.current.updateRows([newRow]);
        console.log(apiRef.current.getRow(id));
        // setRowModesModel(oldModel => ({
        //     ...oldModel,
        //     [id]: {mode: GridRowModes.Edit, fieldToFocus: 'name'}
        // }))
    }

    const discardChanges = () => {
        for (const row of Object.values(unsavedChangesRef.current.rowsBeforeChange)) {
            apiRef.current.updateRows([row]);
        }
        unsavedChangesRef.current = {
            unsavedRows: {},
            rowsBeforeChange: {},
        };
    };

    const saveChanges = async () => {
        try {
            // Persist updates in the database
            setIsSaving(true);
            const updateRequest = Object.values(unsavedChangesRef.current.unsavedRows).map(row => {
                const {_action, ...rest} = row;
                if (_action === 'delete') {
                    return {action: 'delete', item: rest};
                } else if (row.id.startsWith('newRow#')) {
                    const {id, ...createRest} = rest;
                    return {action: 'create', item: createRest};
                } else {
                    return {action: 'update', item: rest};
                }
            });
            console.log(updateRequest);
            await new Promise((resolve) => {
                setTimeout(resolve, 100);
            });

            setIsSaving(false);
            const rowsToDelete = Object.values(
                unsavedChangesRef.current.unsavedRows,
            ).filter((row) => row._action === 'delete');
            if (rowsToDelete.length > 0) {
                for (const row of rowsToDelete) {
                    // Free version doesn't allow batching of updates
                    // should be replaced with apiRef.current.updateRows(rowsToDelete); instead of the for loop
                    apiRef.current.updateRows([row]);
                }
            }

            unsavedChangesRef.current = {
                unsavedRows: {},
                rowsBeforeChange: {},
            };
        } catch (error) {
            setIsSaving(false);
        }
    };

    return (
        <div style={{width: '100%'}}>
            <div style={{marginBottom: 8}}>
                <LoadingButton
                    loading={isSaving}
                    onClick={addNewRow}
                    startIcon={<AddIcon/>}
                    loadingPosition="start"
                >
                    <span>New Row</span>
                </LoadingButton>
                <LoadingButton
                    disabled={Object.keys(unsavedChangesRef.current.unsavedRows).length === 0}
                    loading={isSaving}
                    onClick={saveChanges}
                    startIcon={<SaveIcon/>}
                    loadingPosition="start"
                >
                    <span>Save</span>
                </LoadingButton>
                <Button
                    disabled={Object.keys(unsavedChangesRef.current.unsavedRows).length === 0 || isSaving}
                    onClick={discardChanges}
                    startIcon={<RestoreIcon/>}
                >
                    Discard all changes
                </Button>
            </div>
            <div style={{height: 400}}>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    apiRef={apiRef}
                    disableRowSelectionOnClick
                    processRowUpdate={processRowUpdate}
                    rowModesModel={rowModesModel}
                    onRowModesModelChange={setRowModesModel}
                    ignoreValueFormatterDuringExport
                    sx={{
                        '& .MuiDataGrid-row.row--removed': {
                            backgroundColor: (theme) => {
                                if (theme.palette.mode === 'light') {
                                    return 'rgba(255, 170, 170, 0.3)';
                                }
                                return darken('rgba(255, 170, 170, 1)', 0.7);
                            },
                        },
                        '& .MuiDataGrid-row.row--edited': {
                            backgroundColor: (theme) => {
                                if (theme.palette.mode === 'light') {
                                    return 'rgba(255, 254, 176, 0.3)';
                                }
                                return darken('rgba(255, 254, 176, 1)', 0.6);
                            },
                        },
                    }}
                    loading={isSaving}
                    getRowClassName={({id}) => {
                        const unsavedRow = unsavedChangesRef.current.unsavedRows[id];
                        if (unsavedRow) {
                            if (unsavedRow._action === 'delete') {
                                return 'row--removed';
                            }
                            return 'row--edited';
                        }
                        return '';
                    }}
                />
            </div>
        </div>
    );
}
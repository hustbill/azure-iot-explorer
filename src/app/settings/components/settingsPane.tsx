/***********************************************************
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License
 **********************************************************/
import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { Panel, PanelType } from 'office-ui-fabric-react/lib/Panel';
import { Link } from 'office-ui-fabric-react/lib/Link';
import { PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import { Toggle } from 'office-ui-fabric-react/lib/Toggle';
import { LocalizationContextConsumer, LocalizationContextInterface } from '../../shared/contexts/localizationContext';
import { ResourceKeys } from '../../../localization/resourceKeys';
import RepositoryLocationList from './repositoryLocationList';
import { REPOSITORY_LOCATION_TYPE } from '../../constants/repositoryLocationTypes';
import { ConfirmationDialog } from './confirmationDialog';
import { ThemeContextConsumer, ThemeContextInterface, Theme } from '../../shared/contexts/themeContext';
import HubConnectionStringSection from '../../login/components/hubConnectionStringSection';
import { THEME_SELECTION } from '../../constants/browserStorage';
import { Notification } from '../../api/models/notification';
import { getConnectionInfoFromConnectionString } from '../../api/shared/utils';
import { generateConnectionStringValidationError, formatConnectionStrings } from '../../shared/utils/hubConnectionStringHelper';
import { ROUTE_PARTS } from '../../constants/routes';
import '../../css/_settingsPane.scss';

export interface SettingsPaneProps extends Settings {
    isOpen: boolean;
}

export interface SettingsPaneActions {
    onSettingsVisibleChanged: (visible: boolean) => void;
    onSettingsSave: (payload: Settings) => void;
    refreshDevices: () => void;
    addNotification: (notification: Notification) => void;
}

export interface RepositorySettings {
    repositoryLocationType: REPOSITORY_LOCATION_TYPE;
    connectionString?: string;
}

export interface Settings {
    hubConnectionString: string;
    hubConnectionStringList: string[];
    repositoryLocations?: RepositorySettings[];
}

interface SettingsPaneState extends Settings{
    isDarkTheme: boolean;
    isDirty: boolean;
    hubConnectionStringError: string;
    showConfirmationDialog: boolean;
}

export default class SettingsPane extends React.Component<SettingsPaneProps & SettingsPaneActions & RouteComponentProps, SettingsPaneState> {
    constructor(props: SettingsPaneProps & SettingsPaneActions & RouteComponentProps) {
        super(props);
        const repositoryLocations = props.repositoryLocations ? props.repositoryLocations.map(value => {
            return {
                connectionString: value.connectionString,
                repositoryLocationType: value.repositoryLocationType};
            }) : [];
        const theme = localStorage.getItem(THEME_SELECTION);

        this.state = {
            hubConnectionString: props.hubConnectionString,
            hubConnectionStringError: '',
            hubConnectionStringList: props.hubConnectionStringList,
            isDarkTheme: Theme.dark === theme || Theme.highContrastBlack === theme,
            isDirty: false,
            repositoryLocations,
            showConfirmationDialog: false,
        };
    }

    public static getDerivedStateFromProps(props: SettingsPaneProps, state: SettingsPaneState) {
        const updatedState = {...state};
        if (!props.isOpen) {
            updatedState.hubConnectionString = props.hubConnectionString;
            updatedState.hubConnectionStringList = props.hubConnectionStringList;
        }

        return updatedState;
    }

    public render(): JSX.Element {
        return (
            <LocalizationContextConsumer>
                {(context: LocalizationContextInterface) => (
                    <Panel
                        className="settingsPane"
                        role="dialog"
                        isOpen={this.props.isOpen}
                        onDismiss={this.dismissPane}
                        type={PanelType.medium}
                        isFooterAtBottom={true}
                        onRenderFooter={this.settingsFooter}
                        closeButtonAriaLabel={context.t(ResourceKeys.common.close)}
                    >
                        <header className="panel-header">
                            <h2>{context.t(ResourceKeys.settings.headerText)}</h2>
                        </header>
                        <section aria-label={context.t(ResourceKeys.settings.configuration.headerText)}>
                            <h3 role="heading" aria-level={1}>{context.t(ResourceKeys.settings.configuration.headerText)}</h3>
                            <HubConnectionStringSection
                                addNotification={this.props.addNotification}
                                connectionString={this.state.hubConnectionString}
                                connectionStringError={this.state.hubConnectionStringError}
                                connectionStringList={this.state.hubConnectionStringList}
                                onChangeConnectionString={this.onChangeHubConnectionString}
                                onRemoveConnectionString={this.onRemoveHubConnectionString}
                            />
                        </section>
                        <section aria-label={context.t(ResourceKeys.settings.modelDefinitions.headerText)}>
                            <h3 role="heading" aria-level={1}>{context.t(ResourceKeys.settings.modelDefinitions.headerText)}</h3>
                            <span className="helptext">{context.t(ResourceKeys.settings.modelDefinitions.helpText)}</span>
                            <RepositoryLocationList
                                items={this.state.repositoryLocations}
                                onAddListItem={this.onAddListItem}
                                onMoveItem={this.onMoveRepositoryLocation}
                                onPrivateRepositoryConnectionStringChanged={this.onPrivateRepositoryConnectionStringChanged}
                                onRemoveListItem={this.onRemoveListItem}
                            />
                        </section>
                        <section aria-label={context.t(ResourceKeys.settings.theme.headerText)}>
                            <h3 role="heading" aria-level={1}>{context.t(ResourceKeys.settings.theme.headerText)}</h3>
                            <Toggle
                                onText={context.t(ResourceKeys.settings.theme.darkTheme)}
                                offText={context.t(ResourceKeys.settings.theme.lightTheme)}
                                onChange={this.setTheme}
                                checked={this.state.isDarkTheme}
                            />
                        </section>
                        {this.renderConfirmationDialog(context)}
                    </Panel>
                )}
            </LocalizationContextConsumer>
        );
    }

    private readonly setTheme = (ev: React.MouseEvent<HTMLElement>, isDarkTheme: boolean) => {
        this.setState({
            isDarkTheme,
            isDirty: true,
        });
    }

    private readonly renderConfirmationDialog = (context: LocalizationContextInterface) => {
        if (this.state.isDirty && this.state.showConfirmationDialog) {
            return (
                <ConfirmationDialog
                    t={context.t}
                    messageKey={ResourceKeys.settings.confirmationMessage}
                    onYes={this.onDialogConfirmCancel}
                    onNo={this.closeDialog}
                />
            );
        }
    }

    private readonly onAddListItem = (type: REPOSITORY_LOCATION_TYPE) => {
        const items = this.state.repositoryLocations;
        items.push({
            repositoryLocationType: type
        });
        this.setState({
            isDirty: true,
            repositoryLocations: [...items]
        });
    }

    private readonly onRemoveListItem = (index: number) => {
        const items = this.state.repositoryLocations;
        items.splice(index, 1);
        this.setState({
            isDirty: true,
            repositoryLocations: [...items]
        });
    }

    private readonly onPrivateRepositoryConnectionStringChanged = (connectionString: string) => {
        const items = this.state.repositoryLocations;
        const item = items[items.findIndex(value => value.repositoryLocationType === REPOSITORY_LOCATION_TYPE.Private)];
        item.connectionString = connectionString;
        this.setState({
            isDirty: true,
            repositoryLocations: [...items]
        });
    }

    private readonly onMoveRepositoryLocation = (oldIndex: number, newIndex: number) => {
        const items = this.state.repositoryLocations;
        items.splice(newIndex, 0, items.splice(oldIndex, 1)[0]);
        this.setState({
            isDirty: true,
            repositoryLocations: [...items]
        });
    }

    private readonly onChangeHubConnectionString = (hubConnectionString: string, newString?: boolean) => {
        const hubConnectionStringError = generateConnectionStringValidationError(hubConnectionString);
        const hubConnectionStringList = newString && !hubConnectionStringError ? [hubConnectionString, ...this.state.hubConnectionStringList] : this.state.hubConnectionStringList;
        this.setState({
            hubConnectionString,
            hubConnectionStringError,
            hubConnectionStringList,
            isDirty: true
        });
    }

    private readonly onRemoveHubConnectionString = (connectionStringToRemove: string) => {
        const hubConnectionStringList = this.state.hubConnectionStringList.filter(s => s !== connectionStringToRemove);
        const hubConnectionString = hubConnectionStringList.length > 0 ? hubConnectionStringList[0] : '';
        const hubConnectionStringError = generateConnectionStringValidationError(hubConnectionString);

        this.setState({
            hubConnectionString,
            hubConnectionStringError,
            hubConnectionStringList,
            isDirty: true
        });
    }

    private readonly dismissPane = (event?: React.SyntheticEvent<HTMLElement, Event>) => {
        event.preventDefault();
        if (this.state.isDirty) {
            this.revertState();
        }
        this.props.onSettingsVisibleChanged(false);
    }

    private readonly closePane = () => {
        if (this.state.isDirty) {
            this.showDialog();
        }
        else {
            this.props.onSettingsVisibleChanged(false);
        }
    }

    private readonly onDialogConfirmCancel = (): void => {
        this.revertState();
        this.props.onSettingsVisibleChanged(false);
    }

    private readonly revertState = (): void => {
        this.setState({
            hubConnectionString: this.props.hubConnectionString,
            hubConnectionStringError: '',
            isDirty: false,
            repositoryLocations: [...(this.props.repositoryLocations && this.props.repositoryLocations.map(value => {
                return {
                    connectionString: value.connectionString,
                    repositoryLocationType: value.repositoryLocationType
                };
            }))],
            showConfirmationDialog: false
        });
    }

    private readonly showDialog = (): void => {
        this.setState({ showConfirmationDialog: true });
    }

    private readonly closeDialog = (): void => {
        this.setState({ showConfirmationDialog: false });
    }

    private readonly saveSettings = () => {
        const settings = {...this.state};
        settings.hubConnectionStringList = formatConnectionStrings(settings.hubConnectionStringList, settings.hubConnectionString);

        this.props.onSettingsSave(settings);
        this.setState({
            isDirty: false
        });
        this.props.onSettingsVisibleChanged(false);

        const { hostName } = getConnectionInfoFromConnectionString(this.state.hubConnectionString);
        const targetPath = `/${ROUTE_PARTS.RESOURCE}/${hostName}/${ROUTE_PARTS.DEVICES}`;
        if (this.props.location.pathname !== targetPath) {
            this.props.history.push(targetPath);
        }

        this.props.refreshDevices();
    }

    private readonly settingsFooter = () => {
        return (
        <LocalizationContextConsumer>
            {(context: LocalizationContextInterface) => (
                <footer className="settings-footer">
                    <section aria-label={context.t(ResourceKeys.settings.questions.headerText)}>
                        <h3 role="heading" aria-level={1}>{context.t(ResourceKeys.settings.questions.headerText)}</h3>
                        <ul className="faq">
                            <li className="faq-item">
                                <Link
                                    href={context.t(ResourceKeys.settings.questions.questions.documentation.link)}
                                    target="_blank"
                                >{context.t(ResourceKeys.settings.questions.questions.documentation.text)}
                                </Link>
                            </li>
                        </ul>
                    </section>
                    <section className="footer-buttons">
                        <h3 role="heading" aria-level={1}>{context.t(ResourceKeys.settings.footerText)}</h3>
                        <ThemeContextConsumer>
                            {(themeContext: ThemeContextInterface) => (
                                <PrimaryButton
                                    type="submit"
                                    disabled={this.disableSaveButton()}
                                    text={context.t(ResourceKeys.settings.save)}
                                    // tslint:disable-next-line: jsx-no-lambda
                                    onClick={() => {
                                        themeContext.updateTheme(this.state.isDarkTheme);
                                        this.saveSettings();
                                    }
                                    }
                                />
                            )}
                        </ThemeContextConsumer>
                        <DefaultButton
                            type="reset"
                            text={context.t(ResourceKeys.settings.cancel)}
                            onClick={this.closePane}
                        />
                    </section>
                </footer>
            )}
            </LocalizationContextConsumer>
        );
    }

    private readonly disableSaveButton = () => {
        const shouldBeDisabled = !this.state.isDirty || !!this.state.hubConnectionStringError;
        if (shouldBeDisabled) {
            return shouldBeDisabled;
        }
        else {
            // when state is dirty and has no errors, check if private repo has been added along with it's connection string
            const privateLocationSetting = this.state.repositoryLocations.filter(location => location.repositoryLocationType === REPOSITORY_LOCATION_TYPE.Private);
            if (privateLocationSetting && privateLocationSetting.length !== 0  ) {
                return !privateLocationSetting[0].connectionString;
            }
        }
    }
}

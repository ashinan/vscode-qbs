import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

import {QbsSession} from './qbssession';
import * as QbsUtils from './qbsutils';

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export class QbsStatusBar implements vscode.Disposable {
    private _statusButton: vscode.StatusBarItem;
    private _projectButton: vscode.StatusBarItem;
    private _profileButton: vscode.StatusBarItem;
    private _configurationButton: vscode.StatusBarItem;
    private _buildRunButton: vscode.StatusBarItem;

    constructor(private readonly _session: QbsSession) {
        const alignment = vscode.StatusBarAlignment.Left;

        this._statusButton = vscode.window.createStatusBarItem(alignment, -1);
        this._statusButton.tooltip = localize('qbs.status.tooltip', 'QBS session status');
        this._statusButton.show();

        this._projectButton = vscode.window.createStatusBarItem(alignment, -2);
        this._projectButton.tooltip = localize('qbs.active.project.select.tooltip',
                                               'Click to select the active project');
        this._projectButton.command = 'qbs.selectProject';
        this._projectButton.show();

        this._profileButton = vscode.window.createStatusBarItem(alignment, -3);
        this._profileButton.tooltip = localize('qbs.build.profile.select.tooltip',
                                               'Click to select the build profile');
        this._profileButton.command = 'qbs.selectProfile';
        this._profileButton.show();

        this._configurationButton = vscode.window.createStatusBarItem(alignment, -4);
        this._configurationButton.tooltip = localize('qbs.build.configuration.select.tooltip',
                                                     'Click to select the build configuration');
        this._configurationButton.command = 'qbs.selectConfiguration';
        this._configurationButton.show();

        this._buildRunButton = vscode.window.createStatusBarItem(alignment, -5);
        this._buildRunButton.text = localize('qbs.build.run', `$(gear) Build`);
        this._buildRunButton.tooltip = localize('qbs.build.run.tooltip',
                                                'Build the selected target');
        this._buildRunButton.command = 'qbs.build';
        this._buildRunButton.show();

        _session.onStatusChanged(status => this.updateSessionStatus(
            QbsUtils.sessionStatusName(this._session.status)));
        _session.onProjectUriChanged(uri => this.updateProjectFileName(uri));
        _session.onProfileNameChanged(name => this.updateProfileName(name));
        _session.onConfigurationNameChanged(name => this.updateConfigurationName(name));

        this.initialize();
    }

    dispose() {
        this._buildRunButton.dispose();
        this._configurationButton.dispose();
        this._profileButton.dispose();
        this._projectButton.dispose();
        this._statusButton.dispose();
    }

    private async initialize() {
        await this.updateSessionStatus(
            QbsUtils.sessionStatusName(this._session.status));
        await this.updateProjectFileName();
        await this.updateProfileName();
        await this.updateConfigurationName();
    }

    private async updateSessionStatus(status: string) {
        this._statusButton.text = localize('qbs.session.status', `$(info) QBS: ${status}`);
    }

    private async updateProjectFileName(uri?: vscode.Uri) {
        const text = uri ? QbsUtils.fileBaseName(uri)
                         : localize('qbs.active.project.empty', 'empty');
        this._projectButton.text = localize('qbs.active.project.select',
                                            `$(project) [${text}]`);
    }

    private async updateProfileName(profile?: string) {
        const text = profile ? profile : localize('qbs.active.profile.empty', 'none');
        this._profileButton.text = localize('qbs.build.profile.select',
                                            `$(tools) [${text}]`);
    }

    private async updateConfigurationName(configuration?: string) {
        const text = configuration ? configuration : 'default';
        this._configurationButton.text = localize('qbs.build.configuration.select',
                                                  `$(settings) [${text}]`);
    }
}

import * as vscode from 'vscode';

import * as QbsCommands from './qbscommands';

import {QbsSessionLogger} from './qbssessionlogger';
import {QbsSession} from './qbssession';
import {QbsStatusBar} from './qbsstatusbar';
import {QbsCpp} from './qbscpp';
import {QbsProjectExplorer} from './qbsprojectexplorer'

let manager: QbsExtensionManager;

class QbsExtensionManager implements vscode.Disposable {
    private _session: QbsSession = new QbsSession(this._ctx);
    private _statusBar: QbsStatusBar = new QbsStatusBar(this._session);
    private _logger: QbsSessionLogger = new QbsSessionLogger(this._session);
    private _cpp: QbsCpp = new QbsCpp(this._session);
    private _explorer: QbsProjectExplorer = new QbsProjectExplorer(this._session);

    constructor(private readonly _ctx: vscode.ExtensionContext) {
        QbsCommands.subscribeCommands(_ctx, this._session);
    }

    dispose() {
        this._explorer.dispose();
        this._cpp.dispose();
        this._logger.dispose();
        this._statusBar.dispose();
        this._session.dispose();
    }
}

export async function activate(ctx: vscode.ExtensionContext) {
    console.log('Extension "qbs-tools" is now active!');
    manager = new QbsExtensionManager(ctx);

    await vscode.commands.executeCommand('qbs.autoRestartSession');
}

export async function deactivate() {
    manager.dispose();
}

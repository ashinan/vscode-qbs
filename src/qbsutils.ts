import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as which from 'which';

import { basename } from 'path';

import { QbsSessionStatus } from './qbssession';
import * as QbsConfig from './qbsconfig';

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export async function enumerateProjects(): Promise<vscode.Uri[]> {
    return await vscode.workspace.findFiles('*.qbs');
}

export async function enumerateBuildProfiles(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
        const qbsPath = QbsConfig.fetchQbsPath();
        if (qbsPath.length === 0) {
            reject(undefined);
        } else {
            let qbsShell = `${qbsPath} config --list`;
            const qbsSettingsDirectory = QbsConfig.fetchQbsSettingsDirectory();
            if (qbsSettingsDirectory.length > 0) {
                qbsShell += ' --settings-dir ' + qbsSettingsDirectory;
            }
            cp.exec(qbsShell, (error, stdout, stderr) => {
                if (error) {
                    reject(undefined);
                } else {
                    let profiles: string[] = [];
                    stdout.split('\n').map(function (line) {
                        if (!line.startsWith('profiles'))
                            return;
                        const startIndex = line.indexOf('.');
                        if (startIndex !== -1) {
                            const endIndex = line.indexOf('.', startIndex + 1);
                            if (endIndex != -1) {
                                const profile = line.substring(startIndex + 1, endIndex);
                                if (profiles.indexOf(profile) === -1)
                                    profiles.push(profile);
                            }
                        }
                    });
                    resolve(profiles);
                }
            });
        }
    });
}

export async function enumerateBuildConfigurations(): Promise<string[]> {
    return ['debug', 'release'];
}

export function expandPath(path?: string): string | undefined {
    if (path?.includes('${workspaceFolder}')) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const workspaceFolder = workspaceFolders[0].uri.fsPath;
            path = path.replace('${workspaceFolder}', workspaceFolder);
        }
    }
    return path?.replace(/\\/g, '/');
}

export function sessionStatusName(status: QbsSessionStatus): string {
    switch (status) {
    case QbsSessionStatus.Started:
        return localize('qbs.session.status.started', "started");
    case QbsSessionStatus.Starting:
        return localize('qbs.session.status.started', "starting");
    case QbsSessionStatus.Stopped:
        return localize('qbs.session.status.started', "stopped");
    case QbsSessionStatus.Stopping:
        return localize('qbs.session.status.started', "stopping");
    }
}

export async function ensureQbsExecutableConfigured(): Promise<boolean> {
    let qbsPath = QbsConfig.fetchQbsPath();
    if (qbsPath === 'qbs') {
        qbsPath = which.sync(qbsPath);
    }

    if (qbsPath.length === 0) {
        vscode.window.showErrorMessage(localize('qbs.executable.missed.error.message',
                                                'QBS executable not set in configuration.'));
        return false;
    } else if (!fs.existsSync(qbsPath)) {
        vscode.window.showErrorMessage(localize('qbs.executable.not-found.error.message',
                                                `QBS executable ${qbsPath} not found.`));
        return false;
    }
    vscode.window.showInformationMessage(localize('qbs.executable.found.info.message',
                                                  `QBS executable found in ${qbsPath}.`));
    return true;
}

export function fileBaseName(uri: vscode.Uri): string {
    return basename(uri.fsPath);
}

type LanguageStandard = 'c89' | 'c99' | 'c11' | 'c18' | 'gnu89' | 'gnu99' | 'gnu11' | 'gnu18'
                        | 'c++98' | 'c++03' | 'c++11' | 'c++14' | 'c++17' | 'c++20'
                        | 'gnu++98' | 'gnu++03' | 'gnu++11' | 'gnu++14' | 'gnu++17' | 'gnu++20';

export function extractLanguageStandard(properties?: any, tags?: string[]): LanguageStandard {
    if (properties && tags) {
        if (tags.indexOf('cpp') !== -1) {
            const languageVersion = properties['cpp.cxxLanguageVersion'];
            if (languageVersion && languageVersion.length > 0) {
                return languageVersion[0];
            } else {
                // FIXME: We need to determine the correct version
                // of the compiler for the supported standard.
                // Because all current values are taken approximately.
                const toolchain = properties['qbs.toolchain'];
                const major = properties['cpp.compilerVersionMajor'] || 0;
                const minor = properties['cpp.compilerVersionMinor'] || 0;
                const patch = properties['cpp.compilerVersionPatch'] || 0;
                const architecture = properties['qbs.architecture'] || [];
                if (toolchain.indexOf('msvc') !== -1) {
                    return 'c++11';
                } else if (toolchain.indexOf('clang') !== -1) {
                    if (major >= 10) {
                        return 'c++20';
                    } else if (major >= 5) {
                        return 'c++17';
                    } else if (major > 3 || (major === 3 && minor > 4)) {
                        return 'c++14';
                    } else if (major > 3 || (major === 3 && minor > 3)) {
                        return 'c++11';
                    } else {
                        return 'c++03';
                    }
                } else if (toolchain.indexOf('gcc') !== -1) {
                    if (major >= 11) {
                        return 'c++17';
                    } else if (major > 6 || (major === 6 && minor > 1)) {
                        return 'c++14';
                    } else if (major > 4 || (major === 4 && minor > 8)
                            || (major === 4 && minor == 8 && patch > 1)) {
                        return 'c++11';
                    } else {
                        return 'c++03';
                    }
                } else if (toolchain.indexOf('iar') !== -1) {
                    return 'c++03';
                } else if (toolchain.indexOf('keil') !== -1
                            && architecture.indexOf('arm') !== -1) {
                    if (major >= 5) {
                        return 'c++11';
                    } else {
                        return 'c++03';
                    }
                }
            }
        } else if (tags.indexOf('c') !== -1) {
            const languageVersion = properties['cpp.cLanguageVersion'];
            if (languageVersion && languageVersion.length > 0) {
                return languageVersion[0];
            } else {
                // FIXME: We need to determine the correct version
                // of the compiler for the supported standard.
                // Because all current values are taken approximately.
                const toolchain = properties['qbs.toolchain'];
                const major = properties['cpp.compilerVersionMajor'] || 0;
                const minor = properties['cpp.compilerVersionMinor'] || 0;
                const patch = properties['cpp.compilerVersionPatch'] || 0;
                if (toolchain.indexOf('msvc') !== -1) {
                    return 'c99';
                } else if (toolchain.indexOf('clang') !== -1) {
                    if (major >= 5) {
                        return 'c99';
                    } else {
                        return 'c89';
                    }
                } else if (toolchain.indexOf('gcc') !== -1) {
                    if (major >= 11) {
                        return 'c11';
                    } else if (major > 6 || (major === 6 && minor > 1)) {
                        return 'c11';
                    } else if (major > 4 || (major === 4 && minor > 8)
                                || (major === 4 && minor == 8 && patch > 1)) {
                        return 'c99';
                    } else {
                        return 'c89';
                    }
                } else if (toolchain.indexOf('iar') !== -1) {
                    return 'c99';
                } else if (toolchain.indexOf('keil') !== -1) {
                    if (major >= 5) {
                        return 'c99';
                    } else {
                        return 'c89';
                    }
                } else if (toolchain.indexOf('sdcc') !== -1) {
                    if (major >= 3) {
                        return 'c11';
                    } else {
                        return 'c99';
                    }
                }
            }
        }
    } else if (tags) {
        if (tags.indexOf('cpp') !== -1) {
            return 'c++03';
        } else if (tags.indexOf('c') !== -1) {
            return 'c89';
        }
    }
    return 'c++98';
}

export function extractPrefixHeaders(properties?: any): string[] {
    return properties ? ([].concat(properties['cpp.prefixHeaders'])) : [];
}

export function extractIncludePaths(properties?: any): string[] {
    return properties ? ([]
        .concat(properties['cpp.compilerIncludePaths'])
        .concat(properties['cpp.distributionIncludePaths'])
        .concat(properties['cpp.systemIncludePaths'])
        .concat(properties['cpp.includePaths'])
        .concat(properties['cpp.frameworkPaths'])
        .concat(properties['cpp.systemFrameworkPaths'])) : [];
}

export function extractDefines(properties?: any): string[] {
    return properties ? ([].concat(properties['cpp.defines'])) : [];
}

export function extractCompilerPath(properties?: any): string {
    return properties ? (properties['cpp.compilerPath'] || '') : '';
}

type IntelliSenseMode = 'msvc-x86' | 'msvc-x64' | 'msvc-arm' | 'msvc-arm64'
                        | 'gcc-x86' | 'gcc-x64' | 'gcc-arm' | 'gcc-arm64'
                        | 'clang-x86' | 'clang-x64' | 'clang-arm' | 'clang-arm64';

export function extractIntelliSenseMode(properties?: any): IntelliSenseMode {
    if (properties) {
        const architecture = properties['qbs.architecture'];
        const toolchain = properties['qbs.toolchain'];
        if (architecture && toolchain && toolchain.length > 0) {
            if (toolchain.indexOf('msvc') !== -1) {
                if (architecture === 'x86') {
                    return 'msvc-x86';
                } else if (architecture === 'x86_64') {
                    return 'msvc-x64';
                } else if (architecture.indexOf('arm') !== -1) {
                    return (architecture.indexOf('64') !== -1) ? 'msvc-arm64' : 'msvc-arm';
                }
            } else if (toolchain.indexOf('clang') !== -1
                        || toolchain.indexOf('clang-cl') !== -1
                        || toolchain.indexOf('llvm') !== -1) {
                if (architecture === 'x86') {
                    return 'clang-x86';
                } else if (architecture === 'x86_64') {
                    return 'clang-x64';
                } else if (architecture.indexOf('arm') !== -1) {
                    return (architecture.indexOf('64') !== -1) ? 'clang-arm64' : 'clang-arm';
                }
            } else if (toolchain.indexOf('gcc') !== -1
                        || toolchain.indexOf('mingw') !== -1) {
                if (architecture === 'x86') {
                    return 'gcc-x86';
                } else if (architecture === 'x86_64') {
                    return 'gcc-x64';
                } else if (architecture.indexOf('arm') !== -1) {
                    return (architecture.indexOf('64') !== -1) ? 'gcc-arm64' : 'gcc-arm';
                }
            } else if (toolchain.indexOf('iar') !== -1) {
                if (architecture.indexOf('arm') !== -1) {
                    // Use closer value to IAR ARM compiler intelli sense mode.
                    return 'gcc-arm';
                }
            } else if (toolchain.indexOf('sdcc') !== -1) {
                if (architecture.indexOf('arm') !== -1) {
                    const compilerName = properties['cpp.compilerName'] || '';
                    // Use closer value to KEIL ARM compiler intelli sense mode.
                    return (compilerName.indexOf('armclang') === -1) ? 'gcc-arm' : 'clang-arm';
                }
            }
        }
    }
    return 'gcc-x86';
}

export interface QbsProduct {
    fullDisplayName: string;
    targetExecutable?: string;
}

export async function enumerateProducts(project: any): Promise<QbsProduct[]> {
    let enabledProducts: QbsProduct[] = [];
    const parseProject = (project: any) => {
        const products = project['products'] || [];
        for (const product of products) {
            if (product['is-enabled']) {
                const fullDisplayName = product['full-display-name'];
                const targetExecutable = product['target-executable'];
                enabledProducts.push({
                    fullDisplayName: fullDisplayName,
                    targetExecutable: (targetExecutable && targetExecutable.length > 0)
                        ? targetExecutable : undefined
                });
            }
        }

        const subProjects = project['sub-projects'] || [];
        for (const subProject of subProjects) {
            parseProject(subProject);
        }
    };

    parseProject(project);
    return enabledProducts;
}

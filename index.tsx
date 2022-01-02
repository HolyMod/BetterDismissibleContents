import {DOM, DiscordModules, Injector as InjectorModule, LoggerModule, Webpack, Settings, ReactTools} from "@Holy";
import DismissibleContentContextMenu from "./components/DismissibleContentContextMenu";
import Sections from "./data/sections";
import config from "./manifest.json";
import styles from "./styles.scss";

const {SwitchItem, Forms, ContextMenu} = DiscordModules;
const Logger = new LoggerModule(config.name);
const Injector = InjectorModule.create(config.name);

function ConnectedSwitchItem({id}) {
    const value = Settings.useSettings(() => Settings.get(id, false));

    return (
        <SwitchItem value={value} onChange={() => Settings.set(id, !value)}>
            <Forms.FormText>
                {id}
            </Forms.FormText>
        </SwitchItem>
    );
};

function ConnectedDismissibleContent({id, children, className = ""}) {
    const value = Settings.useSettings(() => Settings.get(id, false));
    
    if (value) return null;

    return (
        <div
            className={className}
            onContextMenu={e => ContextMenu.open(e, () => <DismissibleContentContextMenu content={id} />)}
            data-dismissible={id}
        >
            {children}
        </div>
    );
}

export default class DismissibleContents {
    onStart(): void {
        this.patchTextAreaButtons();
        this.patchDismissibleContentsOptions();
        this.patchTitleBar();

        DOM.injectCSS(config.name, styles);
    }   

    patchDismissibleContentsOptions() {
        const DismissibleContentConfiguration = Webpack.findByDisplayName("DismissibleContentConfiguration", {default: true});
        const sectionKeys = Object.keys(Sections).filter(e => isNaN(Number(e)));

        const resetDismissibleContents = async function () {
            for (let i = 0; i < sectionKeys.length; i++) {
                Settings.set(sectionKeys[i], false);
            }
        };

        Injector.inject({
            module: DismissibleContentConfiguration,
            method: "default",
            after(_, _2, ret) {
                const childs: any[] | void = ReactTools.findInReactTree(ret, e => Array.isArray(e) && e.length > 5);
                const button: any = ReactTools.findInReactTree(ret, e => e?.look && typeof e.onClick === "function");

                if (childs) {
                    const header = (
                        <Forms.FormTitle tag="h5" className="marginBottom28">Better Dismissible Contents</Forms.FormTitle>
                    );
    
                    childs.push(header, ...sectionKeys.map(key => (
                        <ConnectedSwitchItem key={key} id={key} />
                    )));
                }

                if (button) {
                    const original = button.onClick;
                    button.onClick = () => {
                        resetDismissibleContents();
                        original();
                    };
                }
            }
        });
    }

    async patchTextAreaButtons() {
        const [
            ChannelTextAreaGiftButton,
            ChannelTextAreaGifButton,
            ChannelStickerPickerButton,
            textAreaClasses
        ] = Webpack.bulk(
            e => e?.type?.displayName === "ChannelPremiumGiftButton",
            e => e?.type?.render?.displayName === "ChannelGIFPickerButton",
            e => e?.type?.render?.displayName === "ChannelStickerPickerButton",
            ["textAreaHeight", "buttonContainer"]
        );
        
        const map = [
            {
                module: ChannelTextAreaGifButton?.type,
                method: "render",
                type: Sections.GIF_BUTTON
            },
            {
                module: ChannelTextAreaGiftButton,
                method: "type",
                type: Sections.GIFT_BUTTON
            },
            {
                module: ChannelStickerPickerButton?.type,
                method: "render",
                type: Sections.STICKER_BUTTON
            }
        ];
        
        for (let i = 0; i < map.length; i++) {
            const patch = map[i];
            if (!patch.module) continue;

            Injector.inject({
                module: patch.module,
                method: patch.method,
                after(_, __, ret) {
                    return (
                        <ConnectedDismissibleContent id={Sections[patch.type]} className={textAreaClasses.buttonContainer}>
                            {ret}
                        </ConnectedDismissibleContent>
                    );
                }
            });
        }
    }

    async patchTitleBar() {
        const [
            ConnectedUpdateButton,
            ThreadBrowserPopout,
            ChannelNotificationSettingsButton,
            ChannelPinsButton,
            ChannelInfoButton,
            ConnectedSearch,
            HeaderBarContainer
        ] = Webpack.bulk(
            "FluxContainer(UpdateButton)",
            Webpack.Filters.byDisplayName("ThreadBrowserPopout", true),
            Webpack.Filters.byDisplayName("ChannelNotificationSettingsButton", true),
            Webpack.Filters.byDisplayName("ChannelPinsButton", true),
            Webpack.Filters.byDisplayName("ChannelInfoButton", true),
            "FluxContainer(Search)",
            "HeaderBarContainer"
        );

        const UpdateButton = (() => {
            try {
                if (!ConnectedUpdateButton) return null;
                const vnode = ConnectedUpdateButton.prototype.render.call({memoizedGetStateFromStores: () => null});
                if (!vnode?.type) return null;
                
                return vnode.type;
            } catch (error) {
                return null;
            }
        })();

        const Search = (() => {
            try {
                if (!ConnectedSearch) return null;
                const vnode = ConnectedSearch.prototype.render.call({memoizedGetStateFromStores: () => null});
                if (!vnode?.type) return null;
                
                return vnode.type;
            } catch (error) {
                return null;
            }
        })();
        
        const [RecentsButton, HelpButton] = (() => {
            try {
                const instance = new HeaderBarContainer({toolbar: []});
                const rendered = instance.renderToolbar();
                const RecentsButton = ReactTools.findInReactTree(rendered, e => e?.type?.displayName === "RecentsButton");
                const HelpButton = ReactTools.findInReactTree(rendered, e => e?.type?.displayName === "HelpButton");
                if (!RecentsButton) throw new Error("Recents button was nut found!");
                if (!HelpButton) throw new Error("HelpButton was not found!");

                return [RecentsButton, HelpButton];
            } catch (error) {
                Logger.error(error);
                return [null, null];
            }
        })();

        const Buttons = [
            {
                module: UpdateButton?.prototype,
                method: "render",
                type: Sections.UPDATE_BUTTON
            },
            {
                module: Search?.prototype,
                method: "render",
                type: Sections.SEARCH_BAR
            },
            {
                module: HelpButton,
                method: "type",
                type: Sections.HELP_BUTTON
            },
            {
                module: ThreadBrowserPopout,
                method: "default",
                type: Sections.THREADS_BUTTON
            },
            {
                module: RecentsButton,
                method: "type",
                type: Sections.INBOX_BUTTON
            },
            {
                module: ChannelNotificationSettingsButton,
                method: "default",
                type: Sections.NOTIFICATIONS_BUTTON
            },
            {
                module: ChannelPinsButton,
                method: "default",
                type: Sections.PINS_BUTTON
            },
            {
                module: ChannelInfoButton,
                method: "default",
                type: Sections.CHANNEL_INFO_BUTTON
            }
        ];

        for (let i = 0; i < Buttons.length; i++) {
            const {module, method, type} = Buttons[i];

            if (typeof module?.[method] !== "function") continue;

            Injector.inject({
                module: module,
                method: method,
                after(_, __, ret) {
                    return (
                        <ConnectedDismissibleContent id={Sections[type]}>
                            {ret}
                        </ConnectedDismissibleContent>
                    );
                }
            });
        }
    }

    onStop(): void {
        Injector.uninject();
        DOM.clearCSS(config.name);
    }
}
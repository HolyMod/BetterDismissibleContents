import {DiscordModules, Settings} from "@Holy";

const {ContextMenu} = DiscordModules;

export default function DismissibleContentContextMenu({content}) {
    return (
        <ContextMenu.Menu navId={DismissibleContentContextMenu.name} onClose={ContextMenu.close}>
            <ContextMenu.Item
                label="Hide"
                id="hide-dismissible-content"
                action={() => {
                    Settings.set(content, true);
                }}
            />
        </ContextMenu.Menu>
    );
}
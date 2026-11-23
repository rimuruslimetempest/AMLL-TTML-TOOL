import { ImportAppleTtmlDialog } from "$/modules/apple-ttml/modals/ImportAppleTtmlDialog.tsx";
import { LatencyTestDialog } from "$/modules/audio/modals/LatencyTest.tsx";
import { TimingPasteDialog } from "$/modules/clipboard-timing/components/TimingPasteDialog";
import { CloudFileManagerModal } from "$/modules/cloud/modals/CloudFileManagerModal.tsx";
import { DownloaderDialog } from "$/modules/downloader/DownloaderDialog.tsx";
import { RecycleBinDialog } from "$/modules/recycle-bin/RecycleBinDialog";
import { GeniusImportLyricsDialog } from "$/modules/genius/modals/GeniusImportLyricsDialog.tsx";
import { GeniusLyricsRefreshDialog } from "$/modules/genius/modals/GeniusLyricsRefreshDialog.tsx";
import { GeniusSearchDialog } from "$/modules/genius/modals/GeniusSearchDialog.tsx";
import { ImportFromLRCLIB } from "$/modules/lrclib/modals/ImportDialog.tsx";
import { GrammarCheckDialog } from "$/modules/lyric-editor/modals/GrammarCheckDialog.tsx";
import { CensorWordsDialog } from "$/modules/lyric-editor/modals/CensorWordsDialog.tsx";
import { UrbanDictionaryDialog } from "$/modules/lyric-editor/modals/UrbanDictionaryDialog.tsx";
import { CombineWordsDialog } from "$/modules/lyric-editor/tools/CombineWordsDialog.tsx";
import { FindReplaceBar } from "$/modules/lyric-editor/tools/FindReplaceBar.tsx";
import { ReplaceRomanizationDialog } from "$/modules/lyric-editor/tools/ReplaceRomanizationDialog.tsx";
import { ReplaceWordDialog } from "$/modules/lyric-editor/tools/ReplaceWordDialog.tsx";
import { TimeShiftDialog } from "$/modules/lyric-editor/tools/TimeShift.tsx";
import { TimeStretchDialog } from "$/modules/lyric-editor/tools/TimeStretch.tsx";
import { FormatExportDialog, FormatImportDialog } from "$/modules/lyrics-formats/FormatDialogs";
import { ImportLyricsDialog } from "$/modules/lyrics-import/modals/ImportLyricsDialog.tsx";
import { JooxAudioSearchDialog } from "$/modules/joox/modals/JooxAudioSearchDialog.tsx";
import { JooxImportLyricsDialog } from "$/modules/joox/modals/JooxImportLyricsDialog.tsx";
import { HistoryRestoreDialog } from "$/modules/project/modals/HistoryRestore.tsx";
import { HandoffSummaryDialog } from "$/modules/project/handoff/HandoffSummaryDialog";
import { ImportFromText } from "$/modules/project/modals/ImportFromText.tsx";
import { MetadataEditor } from "$/modules/project/modals/MetadataEditor.tsx";
import { AdvancedSegmentationDialog } from "$/modules/segmentation/components/AdvancedSegmentation.tsx";
import { AutoSegmentDialog } from "$/modules/segmentation/components/AutoSegmentDialog.tsx";
import { LearnedSplitsDialog } from "$/modules/segmentation/components/LearnedSplits.tsx";
import { SuggestedSplitsDialog } from "$/modules/segmentation/components/SuggestedSplits.tsx";
import { SplitWordDialog } from "$/modules/segmentation/components/split-word.tsx";
import { ApplySavedSplitsDialog } from "$/modules/split-library/components/ApplySavedSplitsDialog";
import { SplitLibraryDialog } from "$/modules/split-library/components/SplitLibraryDialog";
import { FontSelectionDialog } from "$/modules/settings/modals/FontSelectionDialog.tsx";
import { SettingsDialog } from "$/modules/settings/modals/index.tsx";
import { SetupWizard } from "$/modules/setup/SetupWizard";
import { SongInfoDialog } from "$/modules/song-info/SongInfoDialog";
import { SpotMatchDialog } from "$/modules/spotmatch/SpotMatchDialog.tsx";
import { TTMLChecklistDialog } from "$/modules/ttml-checklist/TTMLChecklistDialog.tsx";
import { ChangelogDialog } from "./changelog.tsx";
import { ConfirmationDialog } from "./confirmation.tsx";
import {
	ExperimentalFeaturesDialog,
	GeniusHeaderDetectionDialog,
} from "./experimental-features.tsx";
import { ImportLyricsChooserDialog } from "./import-lyrics-chooser.tsx";
import { Mp3ConversionDialog } from "./mp3-conversion.tsx";
import { WhatsNewDialog } from "./whats-new.tsx";

export const Dialogs = () => {
	return (
		<>
			<ImportLyricsChooserDialog />
			<ImportFromText />
			<FormatImportDialog />
			<FormatExportDialog />
			<ImportFromLRCLIB />
			<ImportLyricsDialog />
			<JooxImportLyricsDialog />
			<DownloaderDialog />
			<RecycleBinDialog />
			<ImportAppleTtmlDialog />
			<MetadataEditor />
			<SettingsDialog />
			<SetupWizard />
			<SongInfoDialog />
			<SplitWordDialog />
			<SplitLibraryDialog />
			<ApplySavedSplitsDialog />
			<CombineWordsDialog />
			<ReplaceWordDialog />
			<ReplaceRomanizationDialog />
			<FindReplaceBar />
			<TimingPasteDialog />
			<LatencyTestDialog />
			<TTMLChecklistDialog />
			<JooxAudioSearchDialog />
			<SpotMatchDialog />
			<ConfirmationDialog />
			<Mp3ConversionDialog />
			<HistoryRestoreDialog />
			<HandoffSummaryDialog />
			<AdvancedSegmentationDialog />
			<AutoSegmentDialog />
			<LearnedSplitsDialog />
			<TimeShiftDialog />
			<TimeStretchDialog />
			<GrammarCheckDialog />
			<CensorWordsDialog />
			<CloudFileManagerModal />

			<GeniusSearchDialog />
			<GeniusImportLyricsDialog />
			<GeniusLyricsRefreshDialog />
			<ChangelogDialog />
			<WhatsNewDialog />
			<FontSelectionDialog />
			<UrbanDictionaryDialog />
			<SuggestedSplitsDialog />
			<ExperimentalFeaturesDialog />
			<GeniusHeaderDetectionDialog />
		</>
	);
};

export default Dialogs;

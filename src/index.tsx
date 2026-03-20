import { callable, definePlugin, routerHook, toaster } from "@decky/api";
import {
  ButtonItem,
  DialogButton,
  Field,
  Focusable,
  Navigation,
  PanelSection,
  PanelSectionRow,
  TextField,
  SteamSpinner,
  Tabs,
  staticClasses,
} from "@decky/ui";
import { useState, useEffect, useRef } from "react";
import { FaGamepad, FaArrowLeft, FaDownload, FaTrash, FaCheck, FaRedo } from "react-icons/fa";

interface Trainer {
  name: string;
  slug: string;
  url: string;
}

interface Download {
  filename: string;
  url: string;
}

interface TrainerDetails {
  name: string;
  options: string;
  game_version: string;
  last_updated: string;
  downloads: Download[];
}

const getTrainers = callable<[], Trainer[]>("get_trainers");
const getTrainerDetails = callable<[slug: string], TrainerDetails>("get_trainer_details");
const downloadTrainer = callable<[slug: string, name: string, download_url: string], { success: boolean; path?: string; error?: string }>("download_trainer");
const getDownloadedTrainers = callable<[], string[]>("get_downloaded_trainers");
const deleteTrainer = callable<[name: string], { success: boolean; error?: string }>("delete_trainer");
const getTrainerMeta = callable<[slug: string], string[]>("get_trainer_meta");
const backendLog = callable<[level: string, msg: string], void>("log");
function flog(level: string, msg: string) { backendLog(level, msg).catch(() => {}); }

let selectedTrainer: Trainer | null = null;
let initialBrowseTab: string | null = null;
let persistedSearch = "";
let persistedVisibleCount = 50;

const FLINGER_REPO = "https://github.com/mp-pinheiro/flinger";
const CHEATDECK_REPO = "https://github.com/SheffeyG/CheatDeck";

const styles = {
  trainerName: {
    fontWeight: 600,
    fontSize: "14px",
    color: "#dcdee2",
    wordBreak: "break-word" as const,
  } as React.CSSProperties,
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    color: "#8bc34a",
    background: "rgba(139,195,74,0.15)",
    padding: "2px 8px",
    borderRadius: "4px",
  } as React.CSSProperties,
  sectionHeader: {
    fontWeight: 600,
    fontSize: "12px",
    color: "#8bc34a",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    padding: "12px 0 4px 0",
    borderBottom: "1px solid rgba(139,195,74,0.2)",
    marginBottom: "8px",
  } as React.CSSProperties,
  metadata: {
    fontSize: "12px",
    color: "#9ca3af",
    padding: "4px 0",
  } as React.CSSProperties,
  actionRow: {
    display: "flex",
    gap: "8px",
    marginTop: "12px",
  } as React.CSSProperties,
  downloadItem: {
    background: "rgba(255,255,255,0.03)",
    borderRadius: "6px",
    padding: "10px 12px",
    margin: "6px 0",
    border: "1px solid rgba(255,255,255,0.08)",
  } as React.CSSProperties,
  filename: {
    fontSize: "13px",
    color: "#dcdee2",
    fontWeight: 500,
    wordBreak: "break-word" as const,
  } as React.CSSProperties,
  pageOuter: {
    marginTop: "40px",
    height: "calc(100% - 40px)",
    background: "#0005",
  } as React.CSSProperties,
  tabContent: {
    padding: "16px 28px",
    color: "#dcdee2",
  } as React.CSSProperties,
};

function isTrainerDownloaded(downloaded: string[], name: string): boolean {
  const cleanName = name.toLowerCase().replace(/ trainer$/i, "").trim();
  return downloaded.some(
    (d) => d.toLowerCase() === cleanName || d.toLowerCase() === name.toLowerCase().trim()
  );
}

const QR_PATH = "M2,2H3V3H2zM3,2H4V3H3zM4,2H5V3H4zM5,2H6V3H5zM6,2H7V3H6zM7,2H8V3H7zM8,2H9V3H8zM10,2H11V3H10zM13,2H14V3H13zM14,2H15V3H14zM15,2H16V3H15zM16,2H17V3H16zM19,2H20V3H19zM24,2H25V3H24zM25,2H26V3H25zM26,2H27V3H26zM27,2H28V3H27zM28,2H29V3H28zM29,2H30V3H29zM30,2H31V3H30zM2,3H3V4H2zM8,3H9V4H8zM10,3H11V4H10zM11,3H12V4H11zM12,3H13V4H12zM14,3H15V4H14zM16,3H17V4H16zM18,3H19V4H18zM22,3H23V4H22zM24,3H25V4H24zM30,3H31V4H30zM2,4H3V5H2zM4,4H5V5H4zM5,4H6V5H5zM6,4H7V5H6zM8,4H9V5H8zM12,4H13V5H12zM13,4H14V5H13zM14,4H15V5H14zM15,4H16V5H15zM19,4H20V5H19zM20,4H21V5H20zM21,4H22V5H21zM24,4H25V5H24zM26,4H27V5H26zM27,4H28V5H27zM28,4H29V5H28zM30,4H31V5H30zM2,5H3V6H2zM4,5H5V6H4zM5,5H6V6H5zM6,5H7V6H6zM8,5H9V6H8zM12,5H13V6H12zM15,5H16V6H15zM16,5H17V6H16zM19,5H20V6H19zM20,5H21V6H20zM21,5H22V6H21zM24,5H25V6H24zM26,5H27V6H26zM27,5H28V6H27zM28,5H29V6H28zM30,5H31V6H30zM2,6H3V7H2zM4,6H5V7H4zM5,6H6V7H5zM6,6H7V7H6zM8,6H9V7H8zM10,6H11V7H10zM11,6H12V7H11zM12,6H13V7H12zM13,6H14V7H13zM15,6H16V7H15zM20,6H21V7H20zM22,6H23V7H22zM24,6H25V7H24zM26,6H27V7H26zM27,6H28V7H27zM28,6H29V7H28zM30,6H31V7H30zM2,7H3V8H2zM8,7H9V8H8zM10,7H11V8H10zM13,7H14V8H13zM15,7H16V8H15zM24,7H25V8H24zM30,7H31V8H30zM2,8H3V9H2zM3,8H4V9H3zM4,8H5V9H4zM5,8H6V9H5zM6,8H7V9H6zM7,8H8V9H7zM8,8H9V9H8zM10,8H11V9H10zM12,8H13V9H12zM14,8H15V9H14zM16,8H17V9H16zM18,8H19V9H18zM20,8H21V9H20zM22,8H23V9H22zM24,8H25V9H24zM25,8H26V9H25zM26,8H27V9H26zM27,8H28V9H27zM28,8H29V9H28zM29,8H30V9H29zM30,8H31V9H30zM10,9H11V10H10zM12,9H13V10H12zM13,9H14V10H13zM14,9H15V10H14zM17,9H18V10H17zM18,9H19V10H18zM20,9H21V10H20zM2,10H3V11H2zM3,10H4V11H3zM4,10H5V11H4zM7,10H8V11H7zM8,10H9V11H8zM10,10H11V11H10zM11,10H12V11H11zM12,10H13V11H12zM15,10H16V11H15zM16,10H17V11H16zM18,10H19V11H18zM21,10H22V11H21zM23,10H24V11H23zM24,10H25V11H24zM25,10H26V11H25zM26,10H27V11H26zM29,10H30V11H29zM30,10H31V11H30zM4,11H5V12H4zM5,11H6V12H5zM6,11H7V12H6zM7,11H8V12H7zM11,11H12V12H11zM12,11H13V12H12zM15,11H16V12H15zM17,11H18V12H17zM18,11H19V12H18zM19,11H20V12H19zM21,11H22V12H21zM22,11H23V12H22zM23,11H24V12H23zM24,11H25V12H24zM25,11H26V12H25zM29,11H30V12H29zM30,11H31V12H30zM3,12H4V13H3zM6,12H7V13H6zM7,12H8V13H7zM8,12H9V13H8zM9,12H10V13H9zM13,12H14V13H13zM17,12H18V13H17zM21,12H22V13H21zM24,12H25V13H24zM25,12H26V13H25zM26,12H27V13H26zM27,12H28V13H27zM28,12H29V13H28zM30,12H31V13H30zM2,13H3V14H2zM3,13H4V14H3zM6,13H7V14H6zM7,13H8V14H7zM9,13H10V14H9zM10,13H11V14H10zM11,13H12V14H11zM15,13H16V14H15zM22,13H23V14H22zM23,13H24V14H23zM26,13H27V14H26zM27,13H28V14H27zM2,14H3V15H2zM5,14H6V15H5zM6,14H7V15H6zM7,14H8V15H7zM8,14H9V15H8zM10,14H11V15H10zM11,14H12V15H11zM13,14H14V15H13zM14,14H15V15H14zM15,14H16V15H15zM18,14H19V15H18zM22,14H23V15H22zM24,14H25V15H24zM25,14H26V15H25zM30,14H31V15H30zM3,15H4V16H3zM4,15H5V16H4zM6,15H7V16H6zM7,15H8V16H7zM9,15H10V16H9zM11,15H12V16H11zM14,15H15V16H14zM17,15H18V16H17zM18,15H19V16H18zM19,15H20V16H19zM21,15H22V16H21zM22,15H23V16H22zM24,15H25V16H24zM25,15H26V16H25zM29,15H30V16H29zM30,15H31V16H30zM3,16H4V17H3zM4,16H5V17H4zM5,16H6V17H5zM6,16H7V17H6zM7,16H8V17H7zM8,16H9V17H8zM9,16H10V17H9zM12,16H13V17H12zM14,16H15V17H14zM15,16H16V17H15zM16,16H17V17H16zM17,16H18V17H17zM18,16H19V17H18zM19,16H20V17H19zM20,16H21V17H20zM21,16H22V17H21zM23,16H24V17H23zM24,16H25V17H24zM25,16H26V17H25zM26,16H27V17H26zM30,16H31V17H30zM4,17H5V18H4zM5,17H6V18H5zM7,17H8V18H7zM9,17H10V18H9zM10,17H11V18H10zM12,17H13V18H12zM13,17H14V18H13zM14,17H15V18H14zM16,17H17V18H16zM18,17H19V18H18zM21,17H22V18H21zM22,17H23V18H22zM24,17H25V18H24zM25,17H26V18H25zM5,18H6V19H5zM7,18H8V19H7zM8,18H9V19H8zM9,18H10V19H9zM11,18H12V19H11zM12,18H13V19H12zM15,18H16V19H15zM16,18H17V19H16zM18,18H19V19H18zM22,18H23V19H22zM23,18H24V19H23zM24,18H25V19H24zM30,18H31V19H30zM3,19H4V20H3zM7,19H8V20H7zM10,19H11V20H10zM15,19H16V20H15zM16,19H17V20H16zM17,19H18V20H17zM18,19H19V20H18zM21,19H22V20H21zM24,19H25V20H24zM25,19H26V20H25zM28,19H29V20H28zM29,19H30V20H29zM30,19H31V20H30zM2,20H3V21H2zM3,20H4V21H3zM4,20H5V21H4zM8,20H9V21H8zM9,20H10V21H9zM11,20H12V21H11zM13,20H14V21H13zM17,20H18V21H17zM18,20H19V21H18zM19,20H20V21H19zM21,20H22V21H21zM26,20H27V21H26zM27,20H28V21H27zM30,20H31V21H30zM6,21H7V22H6zM9,21H10V22H9zM12,21H13V22H12zM15,21H16V22H15zM17,21H18V22H17zM18,21H19V22H18zM20,21H21V22H20zM22,21H23V22H22zM24,21H25V22H24zM26,21H27V22H26zM2,22H3V23H2zM3,22H4V23H3zM5,22H6V23H5zM7,22H8V23H7zM8,22H9V23H8zM10,22H11V23H10zM13,22H14V23H13zM14,22H15V23H14zM15,22H16V23H15zM17,22H18V23H17zM18,22H19V23H18zM22,22H23V23H22zM23,22H24V23H23zM24,22H25V23H24zM25,22H26V23H25zM26,22H27V23H26zM27,22H28V23H27zM29,22H30V23H29zM10,23H11V24H10zM14,23H15V24H14zM17,23H18V24H17zM18,23H19V24H18zM19,23H20V24H19zM22,23H23V24H22zM26,23H27V24H26zM27,23H28V24H27zM28,23H29V24H28zM30,23H31V24H30zM2,24H3V25H2zM3,24H4V25H3zM4,24H5V25H4zM5,24H6V25H5zM6,24H7V25H6zM7,24H8V25H7zM8,24H9V25H8zM11,24H12V25H11zM14,24H15V25H14zM15,24H16V25H15zM16,24H17V25H16zM17,24H18V25H17zM19,24H20V25H19zM20,24H21V25H20zM22,24H23V25H22zM24,24H25V25H24zM26,24H27V25H26zM30,24H31V25H30zM2,25H3V26H2zM8,25H9V26H8zM10,25H11V26H10zM12,25H13V26H12zM13,25H14V26H13zM14,25H15V26H14zM16,25H17V26H16zM17,25H18V26H17zM18,25H19V26H18zM20,25H21V26H20zM21,25H22V26H21zM22,25H23V26H22zM26,25H27V26H26zM30,25H31V26H30zM2,26H3V27H2zM4,26H5V27H4zM5,26H6V27H5zM6,26H7V27H6zM8,26H9V27H8zM12,26H13V27H12zM15,26H16V27H15zM16,26H17V27H16zM18,26H19V27H18zM21,26H22V27H21zM22,26H23V27H22zM23,26H24V27H23zM24,26H25V27H24zM25,26H26V27H25zM26,26H27V27H26zM27,26H28V27H27zM30,26H31V27H30zM2,27H3V28H2zM4,27H5V28H4zM5,27H6V28H5zM6,27H7V28H6zM8,27H9V28H8zM11,27H12V28H11zM15,27H16V28H15zM16,27H17V28H16zM17,27H18V28H17zM20,27H21V28H20zM21,27H22V28H21zM22,27H23V28H22zM23,27H24V28H23zM26,27H27V28H26zM27,27H28V28H27zM28,27H29V28H28zM30,27H31V28H30zM2,28H3V29H2zM4,28H5V29H4zM5,28H6V29H5zM6,28H7V29H6zM8,28H9V29H8zM10,28H11V29H10zM12,28H13V29H12zM13,28H14V29H13zM17,28H18V29H17zM20,28H21V29H20zM23,28H24V29H23zM26,28H27V29H26zM29,28H30V29H29zM30,28H31V29H30zM2,29H3V30H2zM8,29H9V30H8zM10,29H11V30H10zM15,29H16V30H15zM17,29H18V30H17zM18,29H19V30H18zM22,29H23V30H22zM25,29H26V30H25zM26,29H27V30H26zM27,29H28V30H27zM2,30H3V31H2zM3,30H4V31H3zM4,30H5V31H4zM5,30H6V31H5zM6,30H7V31H6zM7,30H8V31H7zM8,30H9V31H8zM10,30H11V31H10zM12,30H13V31H12zM13,30H14V31H13zM14,30H15V31H14zM15,30H16V31H15zM18,30H19V31H18zM22,30H23V31H22zM26,30H27V31H26zM27,30H28V31H27zM30,30H31V31H30z";

function AboutContent({ compact }: { compact?: boolean }) {
  return (
    <>
      <Focusable focusWithinClassName="gpfocuswithin" onActivate={() => {}}>
        <div style={styles.metadata}>
          Browse and download FLiNG trainers directly from Steam Deck Game Mode.
          Downloaded trainers are saved to ~/FLiNG-Trainers/.
        </div>
      </Focusable>

      <div style={{ ...styles.sectionHeader, marginTop: "16px" }}>CheatDeck</div>
      <Focusable focusWithinClassName="gpfocuswithin" onActivate={() => {}}>
        <div style={styles.metadata}>
          Install CheatDeck to select and launch trainers per-game from Game Mode.
        </div>
      </Focusable>
      <DialogButton
        onClick={() => Navigation.NavigateToExternalWeb(CHEATDECK_REPO)}
        style={{ marginTop: "8px" }}
      >
        Open CheatDeck GitHub
      </DialogButton>

      <div style={{ ...styles.sectionHeader, marginTop: "16px" }}>GitHub</div>
      <Focusable focusWithinClassName="gpfocuswithin" onActivate={() => {}}>
        <div style={styles.metadata}>
          Report issues, contribute, or star the repo.
        </div>
      </Focusable>
      <DialogButton
        onClick={() => Navigation.NavigateToExternalWeb(FLINGER_REPO)}
        style={{ marginTop: "8px" }}
      >
        Open Flinger GitHub
      </DialogButton>

      <Focusable focusWithinClassName="gpfocuswithin" onActivate={() => {}}>
        <div style={{ marginTop: "16px", display: "flex", justifyContent: compact ? "flex-start" : "center" }}>
          <svg viewBox="0 0 33 33" width={compact ? "120" : "180"} height={compact ? "120" : "180"} style={{ background: "#fff", padding: "4px", borderRadius: "4px" }}>
            <path d={QR_PATH} fill="#000" fillRule="nonzero" />
          </svg>
        </div>
      </Focusable>

      <div style={{ fontSize: "11px", color: "#6b7280", textAlign: "center", padding: "16px 0 4px 0" }}>
        Flinger v0.1.0
      </div>
    </>
  );
}

function Content() {
  const [downloadCount, setDownloadCount] = useState(0);

  useEffect(() => {
    getDownloadedTrainers().then((dl) => setDownloadCount(dl.length)).catch(() => {});
  }, []);

  return (
    <>
      <PanelSection>
        <PanelSectionRow>
          <div style={{ fontSize: "12px", color: "#9ca3af", padding: "4px 0" }}>
            {downloadCount} trainers downloaded
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => {
              Navigation.Navigate("/flinger");
              Navigation.CloseSideMenus();
            }}
          >
            Browse Trainers
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => {
              initialBrowseTab = "my-trainers";
              Navigation.Navigate("/flinger");
              Navigation.CloseSideMenus();
            }}
          >
            My Trainers
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
      <PanelSection title="About">
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => Navigation.NavigateToExternalWeb(CHEATDECK_REPO)}>
            CheatDeck Plugin
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => Navigation.NavigateToExternalWeb(FLINGER_REPO)}>
            GitHub
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
      <div style={{ fontSize: "11px", color: "#6b7280", textAlign: "center", padding: "12px 0" }}>
        Flinger v0.1.0
      </div>
    </>
  );
}

function TrainerBrowser() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [search, setSearch] = useState(persistedSearch);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloaded, setDownloaded] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState(() => {
    const t = initialBrowseTab || "browse";
    initialBrowseTab = null;
    return t;
  });
  const [visibleCount, setVisibleCount] = useState(persistedVisibleCount);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(persistedSearch);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTrainers();
  }, []);

  useEffect(() => {
    persistedSearch = search;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setVisibleCount(50);
      persistedVisibleCount = 50;
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  async function loadTrainers() {
    setLoading(true);
    setError("");
    flog("info", "Loading trainer list");
    try {
      const [list, dl] = await Promise.all([getTrainers(), getDownloadedTrainers()]);
      setTrainers(list);
      setDownloaded(dl);
      flog("info", `Loaded ${list.length} trainers, ${dl.length} downloaded`);
    } catch (e: any) {
      const msg = e?.message || "Failed to load trainers";
      flog("error", `loadTrainers failed: ${msg}`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function openDetail(trainer: Trainer) {
    selectedTrainer = trainer;
    Navigation.Navigate("/flinger-detail");
  }

  const lowerSearch = debouncedSearch.toLowerCase();
  const filtered = debouncedSearch
    ? trainers.filter((t) => t.name.toLowerCase().includes(lowerSearch))
    : trainers;

  return (
    <div style={styles.pageOuter}>
      <Tabs
        activeTab={activeTab}
        onShowTab={(tab: string) => {
          setActiveTab(tab);
          if (tab === "my-trainers") getDownloadedTrainers().then(setDownloaded).catch(() => {});
        }}
        tabs={[
          {
            id: "browse",
            title: "Browse",
            content: (
              <div style={styles.tabContent}>
                <Focusable
                  onCancelButton={() => Navigation.NavigateBack()}
                  onOptionsButton={() => {
                    const input = searchRef.current?.querySelector("input");
                    if (input) input.focus();
                  }}
                  onOptionsActionDescription="Search"
                >
                  <div ref={searchRef}>
                    <TextField
                      label="Search trainers"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      bShowClearAction
                    />
                  </div>

                  {loading ? (
                    <SteamSpinner />
                  ) : error ? (
                    <div>
                      <div style={{ color: "#ff4444", padding: "8px 0" }}>{error}</div>
                      <DialogButton onClick={loadTrainers}>Retry</DialogButton>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: "12px", opacity: 0.6, padding: "8px 0" }}>
                        {debouncedSearch
                          ? `${filtered.length} trainers found`
                          : `Showing ${Math.min(visibleCount, filtered.length)} of ${filtered.length} trainers`}
                      </div>

                      {filtered.slice(0, visibleCount).map((t) => {
                        const isDl = isTrainerDownloaded(downloaded, t.name);
                        return (
                          <Field
                            key={t.slug}
                            label={t.name}
                            highlightOnFocus
                            focusable
                            onClick={() => openDetail(t)}
                            bottomSeparator="none"
                            style={isDl ? { background: "rgba(139,195,74,0.08)" } : undefined}
                          >
                            {isDl && <FaCheck style={{ color: "#8bc34a" }} />}
                          </Field>
                        );
                      })}

                      {visibleCount < filtered.length && (
                        <DialogButton
                          onClick={() => {
                            const next = visibleCount + 50;
                            setVisibleCount(next);
                            persistedVisibleCount = next;
                          }}
                          style={{ marginTop: "8px" }}
                        >
                          Load More ({filtered.length - visibleCount} remaining)
                        </DialogButton>
                      )}
                    </>
                  )}
                </Focusable>
              </div>
            ),
          },
          {
            id: "my-trainers",
            title: "My Trainers",
            content: (
              <div style={styles.tabContent}>
                <Focusable onCancelButton={() => Navigation.NavigateBack()}>
                  {loading ? (
                    <SteamSpinner />
                  ) : (() => {
                    const myTrainers = trainers.filter((t) => isTrainerDownloaded(downloaded, t.name));
                    return myTrainers.length === 0 ? (
                      <div style={styles.metadata}>No trainers downloaded yet.</div>
                    ) : (
                      <>
                        <div style={{ fontSize: "12px", opacity: 0.6, padding: "8px 0" }}>
                          {myTrainers.length} downloaded trainer{myTrainers.length !== 1 ? "s" : ""}
                        </div>
                        {myTrainers.map((t) => (
                          <Field
                            key={t.slug}
                            label={t.name}
                            highlightOnFocus
                            focusable
                            onClick={() => {
                              selectedTrainer = t;
                              Navigation.Navigate("/flinger-my-detail");
                            }}
                            bottomSeparator="none"
                            style={{ background: "rgba(139,195,74,0.08)" }}
                          >
                            <FaCheck style={{ color: "#8bc34a" }} />
                          </Field>
                        ))}
                      </>
                    );
                  })()}
                </Focusable>
              </div>
            ),
          },
          {
            id: "about",
            title: "About",
            content: (
              <div style={styles.tabContent}>
                <Focusable onCancelButton={() => Navigation.NavigateBack()}>
                  <AboutContent />
                </Focusable>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function TrainerDetail() {
  const [trainer] = useState<Trainer | null>(selectedTrainer);
  const [details, setDetails] = useState<TrainerDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadedUrls, setDownloadedUrls] = useState<string[]>([]);
  const [downloaded, setDownloaded] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("detail");

  useEffect(() => {
    if (!trainer) return;
    loadDetails();
  }, []);

  async function loadDetails() {
    if (!trainer) return;
    setDetailLoading(true);
    try {
      const [d, urls, dl] = await Promise.all([
        getTrainerDetails(trainer.slug),
        getTrainerMeta(trainer.slug),
        getDownloadedTrainers(),
      ]);
      setDetails(d);
      setDownloadedUrls(urls);
      setDownloaded(dl);
    } catch (e: any) {
      flog("error", `openDetail(${trainer.slug}) failed: ${e?.message}`);
      toaster.toast({ title: "Error", body: e?.message || "Failed to load details" });
      Navigation.NavigateBack();
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDownload(dl: Download) {
    if (!trainer) return;
    setDownloading(dl.url);
    flog("info", `Downloading ${dl.filename} for ${trainer.slug}`);
    try {
      const result = await downloadTrainer(trainer.slug, trainer.name, dl.url);
      if (result.success) {
        flog("info", `Downloaded ${trainer.name} to ${result.path}`);
        toaster.toast({ title: "Downloaded", body: `${trainer.name} ready` });
        const [dl2, urls] = await Promise.all([
          getDownloadedTrainers(),
          getTrainerMeta(trainer.slug),
        ]);
        setDownloaded(dl2);
        setDownloadedUrls(urls);
      } else {
        flog("error", `Download failed: ${result.error}`);
        toaster.toast({ title: "Download Failed", body: result.error || "Unknown error" });
      }
    } catch (e: any) {
      flog("error", `handleDownload exception: ${e?.message}`);
      toaster.toast({ title: "Download Failed", body: e?.message || "Unknown error" });
    } finally {
      setDownloading(null);
    }
  }

  async function handleDelete(name: string) {
    setDeleting(true);
    try {
      const result = await deleteTrainer(name);
      if (result.success) {
        toaster.toast({ title: "Deleted", body: name });
        const [dl, urls] = await Promise.all([
          getDownloadedTrainers(),
          getTrainerMeta(trainer!.slug),
        ]);
        setDownloaded(dl);
        setDownloadedUrls(urls);
      } else {
        toaster.toast({ title: "Delete Failed", body: result.error || "Unknown error" });
      }
    } catch (e: any) {
      toaster.toast({ title: "Delete Failed", body: e?.message || "Unknown error" });
    } finally {
      setDeleting(false);
    }
  }

  if (!trainer) {
    return (
      <div style={styles.pageOuter}>
        <div style={styles.tabContent}>
          <div style={{ color: "#ff4444" }}>No trainer selected</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageOuter}>
      <Tabs
        activeTab={activeTab}
        onShowTab={(tab: string) => setActiveTab(tab)}
        tabs={[
          {
            id: "detail",
            title: trainer.name,
            content: (
              <div style={styles.tabContent}>
                <Focusable onCancelButton={() => Navigation.NavigateBack()}>
                  <DialogButton
                    onClick={() => Navigation.NavigateBack()}
                    style={{ marginBottom: "12px", width: "auto", display: "inline-flex", alignItems: "center", gap: "8px" }}
                  >
                    <FaArrowLeft /> Back
                  </DialogButton>

                  {detailLoading ? (
                    <SteamSpinner />
                  ) : details ? (
                    <>
                      {details.options && (
                        <div style={{ ...styles.metadata, marginTop: "8px" }}>
                          {details.options} Options · {details.game_version} · Updated {details.last_updated}
                        </div>
                      )}

                      <div style={styles.sectionHeader}>Downloads</div>

                      {details.downloads.map((dl) => {
                        const isDownloading = downloading === dl.url;
                        const isThisDownloaded = downloadedUrls.includes(dl.url);
                        return (
                          <div key={dl.url} style={styles.downloadItem}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={styles.filename}>{dl.filename}</div>
                              {isThisDownloaded && (
                                <div style={styles.badge}><FaCheck size={10} /> Downloaded</div>
                              )}
                            </div>
                            <Focusable style={styles.actionRow} flow-children="horizontal">
                              <DialogButton
                                onClick={() => handleDownload(dl)}
                                disabled={downloading !== null || deleting}
                                style={{ flex: 1 }}
                              >
                                {isDownloading ? (
                                  <SteamSpinner />
                                ) : isThisDownloaded ? (
                                  <>
                                    <FaRedo /> Redownload
                                  </>
                                ) : (
                                  <>
                                    <FaDownload /> Download
                                  </>
                                )}
                              </DialogButton>
                              {isThisDownloaded && (
                                <DialogButton
                                  onClick={() => handleDelete(trainer.name)}
                                  disabled={downloading !== null || deleting}
                                  style={{ flex: "none", minWidth: "auto", width: "40px", padding: "0", display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                  <FaTrash />
                                </DialogButton>
                              )}
                            </Focusable>
                          </div>
                        );
                      })}
                    </>
                  ) : null}
                </Focusable>
              </div>
            ),
          },
          {
            id: "about",
            title: "About",
            content: (
              <div style={styles.tabContent}>
                <Focusable onCancelButton={() => Navigation.NavigateBack()}>
                  <DialogButton
                    onClick={() => Navigation.NavigateBack()}
                    style={{ marginBottom: "12px", width: "auto", display: "inline-flex", alignItems: "center", gap: "8px" }}
                  >
                    <FaArrowLeft /> Back
                  </DialogButton>
                  <AboutContent />
                </Focusable>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function MyTrainerDetail() {
  const [trainer] = useState<Trainer | null>(selectedTrainer);
  const [details, setDetails] = useState<TrainerDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadedUrls, setDownloadedUrls] = useState<string[]>([]);
  const [downloaded, setDownloaded] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!trainer) return;
    loadDetails();
  }, []);

  async function loadDetails() {
    if (!trainer) return;
    setDetailLoading(true);
    try {
      const [d, urls, dl] = await Promise.all([
        getTrainerDetails(trainer.slug),
        getTrainerMeta(trainer.slug),
        getDownloadedTrainers(),
      ]);
      setDetails(d);
      setDownloadedUrls(urls);
      setDownloaded(dl);
    } catch (e: any) {
      flog("error", `myDetail(${trainer.slug}) failed: ${e?.message}`);
      toaster.toast({ title: "Error", body: e?.message || "Failed to load details" });
      Navigation.NavigateBack();
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDownload(dl: Download) {
    if (!trainer) return;
    setDownloading(dl.url);
    try {
      const result = await downloadTrainer(trainer.slug, trainer.name, dl.url);
      if (result.success) {
        toaster.toast({ title: "Downloaded", body: `${trainer.name} ready` });
        const [dl2, urls] = await Promise.all([
          getDownloadedTrainers(),
          getTrainerMeta(trainer.slug),
        ]);
        setDownloaded(dl2);
        setDownloadedUrls(urls);
      } else {
        toaster.toast({ title: "Download Failed", body: result.error || "Unknown error" });
      }
    } catch (e: any) {
      toaster.toast({ title: "Download Failed", body: e?.message || "Unknown error" });
    } finally {
      setDownloading(null);
    }
  }

  async function handleDelete(name: string) {
    setDeleting(true);
    try {
      const result = await deleteTrainer(name);
      if (result.success) {
        toaster.toast({ title: "Deleted", body: name });
        const [dl, urls] = await Promise.all([
          getDownloadedTrainers(),
          getTrainerMeta(trainer!.slug),
        ]);
        setDownloaded(dl);
        setDownloadedUrls(urls);
      } else {
        toaster.toast({ title: "Delete Failed", body: result.error || "Unknown error" });
      }
    } catch (e: any) {
      toaster.toast({ title: "Delete Failed", body: e?.message || "Unknown error" });
    } finally {
      setDeleting(false);
    }
  }

  if (!trainer) {
    return (
      <div style={styles.pageOuter}>
        <div style={styles.tabContent}>
          <div style={{ color: "#ff4444" }}>No trainer selected</div>
        </div>
      </div>
    );
  }

  const downloadedItems = details?.downloads.filter((dl) => downloadedUrls.includes(dl.url)) || [];

  return (
    <div style={styles.pageOuter}>
      <Tabs
        activeTab="my-detail"
        onShowTab={() => {}}
        tabs={[{
          id: "my-detail",
          title: trainer.name,
          content: (
            <div style={styles.tabContent}>
              <Focusable onCancelButton={() => Navigation.NavigateBack()}>
                <DialogButton
                  onClick={() => Navigation.NavigateBack()}
                  style={{ marginBottom: "12px", width: "auto", display: "inline-flex", alignItems: "center", gap: "8px" }}
                >
                  <FaArrowLeft /> Back
                </DialogButton>

                {detailLoading ? (
                  <SteamSpinner />
                ) : downloadedItems.length === 0 ? (
                  <div style={styles.metadata}>No downloaded versions found.</div>
                ) : (
                  <>
                    <div style={styles.sectionHeader}>Downloaded</div>
                    {downloadedItems.map((dl) => {
                      const isDownloading = downloading === dl.url;
                      return (
                        <div key={dl.url} style={styles.downloadItem}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={styles.filename}>{dl.filename}</div>
                            <div style={styles.badge}><FaCheck size={10} /> Downloaded</div>
                          </div>
                          <Focusable style={styles.actionRow} flow-children="horizontal">
                            <DialogButton
                              onClick={() => handleDownload(dl)}
                              disabled={downloading !== null || deleting}
                              style={{ flex: 1 }}
                            >
                              {isDownloading ? (
                                <SteamSpinner />
                              ) : (
                                <><FaRedo /> Redownload</>
                              )}
                            </DialogButton>
                            <DialogButton
                              onClick={() => handleDelete(trainer.name)}
                              disabled={downloading !== null || deleting}
                              style={{ flex: "none", minWidth: "auto", width: "40px", padding: "0", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              <FaTrash />
                            </DialogButton>
                          </Focusable>
                        </div>
                      );
                    })}
                  </>
                )}
              </Focusable>
            </div>
          ),
        }]}
      />
    </div>
  );
}

export default definePlugin(() => {
  routerHook.addRoute("/flinger", TrainerBrowser);
  routerHook.addRoute("/flinger-detail", TrainerDetail);
  routerHook.addRoute("/flinger-my-detail", MyTrainerDetail);
  return {
    name: "Flinger",
    titleView: <div className={staticClasses.Title}>Flinger</div>,
    content: <Content />,
    icon: <FaGamepad />,
    onDismount() {
      routerHook.removeRoute("/flinger");
      routerHook.removeRoute("/flinger-detail");
      routerHook.removeRoute("/flinger-my-detail");
    },
  };
});

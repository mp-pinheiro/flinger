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
let savedPage = 0;

const PAGE_SIZE = 5;
const DETAIL_PAGE_SIZE = 2;

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
    marginTop: "4px",
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
  page: {
    padding: "56px 28px 16px 28px",
    color: "#dcdee2",
  } as React.CSSProperties,
};

function isTrainerDownloaded(downloaded: string[], name: string): boolean {
  const cleanName = name.toLowerCase().replace(/ trainer$/i, "").trim();
  return downloaded.some(
    (d) => d.toLowerCase() === cleanName || d.toLowerCase() === name.toLowerCase().trim()
  );
}

function getDownloadedMatch(downloaded: string[], name: string): string | undefined {
  const cleanName = name.toLowerCase().replace(/ trainer$/i, "").trim();
  return downloaded.find(
    (d) => d.toLowerCase() === cleanName || d.toLowerCase() === name.toLowerCase().trim()
  );
}

function Content() {
  const [downloadCount, setDownloadCount] = useState(0);

  useEffect(() => {
    getDownloadedTrainers().then((dl) => setDownloadCount(dl.length)).catch(() => {});
  }, []);

  return (
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
    </PanelSection>
  );
}

function TrainerBrowser() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(savedPage);
  const [downloaded, setDownloaded] = useState<string[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    savedPage = currentPage;
  }, [currentPage]);

  useEffect(() => {
    loadTrainers();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(0);
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
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div style={styles.page}>
      <Focusable onCancelButton={() => Navigation.NavigateBack()}>
        <div style={{ fontSize: "20px", fontWeight: 600, marginBottom: "12px" }}>
          Flinger
        </div>
        <TextField
          label="Search trainers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          bShowClearAction
        />

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
              {filtered.length} trainers{debouncedSearch ? " found" : ""}
            </div>

            {visible.map((t) => {
              const isDl = isTrainerDownloaded(downloaded, t.name);
              return (
                <Field
                  key={t.slug}
                  label={t.name}
                  description={isDl ? "Downloaded" : undefined}
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

            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}>
                <DialogButton
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  style={{ flex: 1 }}
                >
                  Prev
                </DialogButton>
                <div style={{ fontSize: "12px", color: "#9ca3af", whiteSpace: "nowrap" }}>
                  {safePage + 1} / {totalPages}
                </div>
                <DialogButton
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  style={{ flex: 1 }}
                >
                  Next
                </DialogButton>
              </div>
            )}
          </>
        )}
      </Focusable>
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
  const [detailPage, setDetailPage] = useState(0);

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
    try {
      const result = await deleteTrainer(name);
      if (result.success) {
        toaster.toast({ title: "Deleted", body: name });
        const dl = await getDownloadedTrainers();
        setDownloaded(dl);
      } else {
        toaster.toast({ title: "Delete Failed", body: result.error || "Unknown error" });
      }
    } catch (e: any) {
      toaster.toast({ title: "Delete Failed", body: e?.message || "Unknown error" });
    }
  }

  if (!trainer) {
    return (
      <div style={styles.page}>
        <div style={{ color: "#ff4444" }}>No trainer selected</div>
      </div>
    );
  }

  const isDownloaded = isTrainerDownloaded(downloaded, trainer.name);
  const downloadedMatch = getDownloadedMatch(downloaded, trainer.name);

  return (
    <div style={styles.page}>
      <Focusable onCancelButton={() => Navigation.NavigateBack()}>
        <DialogButton
          onClick={() => Navigation.NavigateBack()}
          style={{ marginBottom: "12px", width: "auto", display: "inline-flex", alignItems: "center", gap: "8px" }}
        >
          <FaArrowLeft /> Back
        </DialogButton>

        <div style={{ ...styles.trainerName, fontSize: "18px", marginBottom: "4px" }}>
          {trainer.name}
        </div>
        {isDownloaded && (
          <div style={styles.badge}>
            <FaCheck size={10} /> Downloaded
          </div>
        )}

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

            {(() => {
              const totalDetailPages = Math.max(1, Math.ceil(details.downloads.length / DETAIL_PAGE_SIZE));
              const safeDetailPage = Math.min(detailPage, totalDetailPages - 1);
              const visibleDownloads = details.downloads.slice(
                safeDetailPage * DETAIL_PAGE_SIZE,
                (safeDetailPage + 1) * DETAIL_PAGE_SIZE
              );
              return (
                <>
                  {visibleDownloads.map((dl) => {
                    const isDownloading = downloading === dl.url;
                    const isThisDownloaded = downloadedUrls.includes(dl.url);
                    return (
                      <div key={dl.url} style={styles.downloadItem}>
                        <div style={styles.filename}>{dl.filename}</div>
                        <div style={styles.actionRow}>
                          <DialogButton
                            onClick={() => handleDownload(dl)}
                            disabled={downloading !== null}
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
                        </div>
                      </div>
                    );
                  })}
                  {totalDetailPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}>
                      <DialogButton
                        onClick={() => setDetailPage((p) => Math.max(0, p - 1))}
                        disabled={safeDetailPage === 0}
                        style={{ flex: 1 }}
                      >
                        Prev
                      </DialogButton>
                      <div style={{ fontSize: "12px", color: "#9ca3af", whiteSpace: "nowrap" }}>
                        {safeDetailPage + 1} / {totalDetailPages}
                      </div>
                      <DialogButton
                        onClick={() => setDetailPage((p) => Math.min(totalDetailPages - 1, p + 1))}
                        disabled={safeDetailPage >= totalDetailPages - 1}
                        style={{ flex: 1 }}
                      >
                        Next
                      </DialogButton>
                    </div>
                  )}
                </>
              );
            })()}

            {downloadedMatch && (
              <>
                <div style={styles.sectionHeader}>Actions</div>
                <ButtonItem
                  label="Delete Trainer"
                  description={`Remove ${downloadedMatch} from your system`}
                  onClick={() => handleDelete(downloadedMatch)}
                >
                  <FaTrash />
                </ButtonItem>
              </>
            )}
          </>
        ) : null}
      </Focusable>
    </div>
  );
}

export default definePlugin(() => {
  routerHook.addRoute("/flinger", TrainerBrowser);
  routerHook.addRoute("/flinger-detail", TrainerDetail);
  return {
    name: "Flinger",
    titleView: <div className={staticClasses.Title}>Flinger</div>,
    content: <Content />,
    icon: <FaGamepad />,
    onDismount() {
      routerHook.removeRoute("/flinger");
      routerHook.removeRoute("/flinger-detail");
    },
  };
});

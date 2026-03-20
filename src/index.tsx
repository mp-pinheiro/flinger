import { callable, definePlugin, toaster } from "@decky/api";
import {
  ButtonItem,
  DialogButton,
  Field,
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
const backendLog = callable<[level: string, msg: string], void>("log");
function flog(level: string, msg: string) { backendLog(level, msg).catch(() => {}); }

const PAGE_SIZE = 50;

const styles = {
  trainerName: {
    fontWeight: 600,
    fontSize: "14px",
    color: "#dcdee2",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    maxWidth: "280px",
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
  const [view, setView] = useState<"list" | "detail">("list");
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [downloaded, setDownloaded] = useState<string[]>([]);

  const [selectedSlug, setSelectedSlug] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [details, setDetails] = useState<TrainerDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    loadTrainers();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setVisibleCount(PAGE_SIZE);
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

  async function openDetail(trainer: Trainer) {
    setSelectedSlug(trainer.slug);
    setSelectedName(trainer.name);
    setDetails(null);
    setView("detail");
    setDetailLoading(true);
    try {
      const d = await getTrainerDetails(trainer.slug);
      setDetails(d);
    } catch (e: any) {
      flog("error", `openDetail(${trainer.slug}) failed: ${e?.message}`);
      toaster.toast({ title: "Error", body: e?.message || "Failed to load details" });
      setView("list");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDownload(dl: Download) {
    setDownloading(dl.url);
    flog("info", `Downloading ${dl.filename} for ${selectedSlug}`);
    try {
      const result = await downloadTrainer(selectedSlug, selectedName, dl.url);
      if (result.success) {
        flog("info", `Downloaded ${selectedName} to ${result.path}`);
        toaster.toast({ title: "Downloaded", body: `${selectedName} ready` });
        const dl2 = await getDownloadedTrainers();
        setDownloaded(dl2);
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

  const lowerSearch = debouncedSearch.toLowerCase();
  const filtered = debouncedSearch
    ? trainers.filter((t) => t.name.toLowerCase().includes(lowerSearch))
    : trainers;
  const visible = filtered.slice(0, visibleCount);

  if (view === "detail") {
    const isDownloaded = isTrainerDownloaded(downloaded, selectedName);
    const downloadedMatch = getDownloadedMatch(downloaded, selectedName);

    return (
      <PanelSection>
        <PanelSectionRow>
          <DialogButton onClick={() => setView("list")} style={{ marginBottom: "8px" }}>
            <FaArrowLeft /> Back
          </DialogButton>
        </PanelSectionRow>

        <PanelSectionRow>
          <div style={{ ...styles.trainerName, fontSize: "16px", maxWidth: "100%" }}>
            {selectedName}
          </div>
          {isDownloaded && (
            <div style={styles.badge}>
              <FaCheck size={10} /> Downloaded
            </div>
          )}
        </PanelSectionRow>

        {detailLoading ? (
          <SteamSpinner />
        ) : details ? (
          <>
            {details.options && (
              <PanelSectionRow>
                <div style={styles.metadata}>
                  {details.options} Options · {details.game_version} · Updated {details.last_updated}
                </div>
              </PanelSectionRow>
            )}

            <div style={styles.sectionHeader}>Downloads</div>

            {details.downloads.map((dl) => {
              const isDownloading = downloading === dl.url;
              return (
                <PanelSectionRow key={dl.url}>
                  <div style={styles.downloadItem}>
                    <div style={styles.filename}>{dl.filename}</div>
                    <div style={styles.actionRow}>
                      <DialogButton
                        onClick={() => handleDownload(dl)}
                        disabled={downloading !== null}
                        style={{ flex: 1 }}
                      >
                        {isDownloading ? (
                          <>
                            <SteamSpinner />
                          </>
                        ) : isDownloaded ? (
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
                </PanelSectionRow>
              );
            })}

            {downloadedMatch && (
              <>
                <div style={styles.sectionHeader}>Actions</div>
                <PanelSectionRow>
                  <ButtonItem
                    label="Delete Trainer"
                    description={`Remove ${downloadedMatch} from your system`}
                    onClick={() => handleDelete(downloadedMatch)}
                  >
                    <FaTrash />
                  </ButtonItem>
                </PanelSectionRow>
              </>
            )}
          </>
        ) : null}
      </PanelSection>
    );
  }

  return (
    <PanelSection>
      <PanelSectionRow>
        <TextField
          label="Search trainers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          bShowClearAction
        />
      </PanelSectionRow>

      {loading ? (
        <SteamSpinner />
      ) : error ? (
        <>
          <PanelSectionRow>
            <div style={{ color: "#ff4444", padding: "8px 0" }}>{error}</div>
          </PanelSectionRow>
          <PanelSectionRow>
            <DialogButton onClick={loadTrainers}>Retry</DialogButton>
          </PanelSectionRow>
        </>
      ) : (
        <>
          <PanelSectionRow>
            <div style={{ fontSize: "12px", opacity: 0.6, padding: "2px 0" }}>
              {filtered.length} trainers{debouncedSearch ? " found" : ""}
            </div>
          </PanelSectionRow>

          {visible.map((t) => {
            const isDownloaded = isTrainerDownloaded(downloaded, t.name);
            return (
              <PanelSectionRow key={t.slug}>
                <Field
                  label={t.name}
                  description={isDownloaded ? "Downloaded" : undefined}
                  highlightOnFocus
                  focusable
                  onClick={() => openDetail(t)}
                  bottomSeparator="none"
                  style={isDownloaded ? { background: "rgba(139,195,74,0.08)" } : undefined}
                >
                  {isDownloaded && <FaCheck style={{ color: "#8bc34a" }} />}
                </Field>
              </PanelSectionRow>
            );
          })}

          {visibleCount < filtered.length && (
            <PanelSectionRow>
              <DialogButton onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                Show more ({filtered.length - visibleCount} remaining)
              </DialogButton>
            </PanelSectionRow>
          )}
        </>
      )}
    </PanelSection>
  );
}

export default definePlugin(() => {
  return {
    name: "Flinger",
    titleView: <div className={staticClasses.Title}>Flinger</div>,
    content: <Content />,
    icon: <FaGamepad />,
    onDismount() {},
  };
});

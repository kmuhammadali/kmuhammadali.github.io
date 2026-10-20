import { useEffect, useRef, useState, type FormEvent } from "react";
import { siteContent } from "../config/siteContent";
import { pageTemplate, settingKeys } from "../../cms/shared/validation";
import type { Page, Resource, RecordData } from "../../cms/shared/types";
import { ADMIN_API_URL, AdminError, cmsApi } from "./api";
import { JsonFields } from "./JsonFields";
import "./admin.css";
const sections = [
  { name: "Home", resource: "content", page: "home" },
  { name: "About", resource: "content", page: "about" },
  { name: "Skills", resource: "skills" },
  { name: "Projects", resource: "projects" },
  { name: "Posts", resource: "posts" },
  { name: "Contact", resource: "content", page: "contact" },
  { name: "Media", resource: "media" },
  { name: "Settings", resource: "settings" },
] as const;
type Section = (typeof sections)[number];
interface Editing {
  resource: Resource;
  data: RecordData;
  isNew: boolean;
}
const entityFields: Partial<Record<Resource, string[]>> = {
  skills: [
    "title",
    "description",
    "image_url",
    "tags",
    "sort_order",
    "is_published",
  ],
  projects: [
    "title",
    "slug",
    "description",
    "image_url",
    "github_url",
    "live_url",
    "tags",
    "sort_order",
    "is_published",
  ],
  posts: [
    "title",
    "slug",
    "excerpt",
    "content",
    "cover_image_url",
    "status",
    "published_at",
    "sort_order",
  ],
  media: [
    "file_name",
    "object_key",
    "mime_type",
    "file_size",
    "public_url",
    "alt_text",
    "sort_order",
    "is_published",
  ],
};
function newRecord(resource: Resource): RecordData {
  const common = { id: crypto.randomUUID(), sort_order: 0 };
  switch (resource) {
    case "skills":
      return {
        ...common,
        title: "",
        description: "",
        image_url: "",
        tags: [],
        is_published: 0,
      };
    case "projects":
      return {
        ...common,
        title: "",
        slug: "",
        description: "",
        image_url: "",
        github_url: "",
        live_url: "",
        tags: [],
        is_published: 0,
      };
    case "posts":
      return {
        ...common,
        title: "",
        slug: "",
        excerpt: "",
        content: "",
        cover_image_url: "",
        status: "draft",
        published_at: null,
      };
    case "media":
      return {
        ...common,
        file_name: "",
        object_key: "",
        mime_type: "image/png",
        file_size: 0,
        public_url: "",
        alt_text: "",
        is_published: 0,
      };
    default:
      return {};
  }
}
const recordKey = (resource: Resource, record: RecordData) =>
  String(record[resource === "settings" ? "key" : "id"]);
const recordTitle = (record: RecordData) =>
  String(
    record.title ??
      record.file_name ??
      record.key ??
      record.section ??
      record.id,
  );
export default function AdminApp() {
  const [session, setSession] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [section, setSection] = useState<Section>(sections[0]);
  const [items, setItems] = useState<RecordData[]>([]);
  const [total, setTotal] = useState(0),
    [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [authError, setAuthError] = useState(false);
  function report(error: unknown) {
    setError(error instanceof Error ? error.message : "Request failed");
    setAuthError(
      error instanceof AdminError && [0, 401, 403].includes(error.status),
    );
  }
  const [deleting, setDeleting] = useState<Editing | null>(null);
  const [settingKey, setSettingKey] =
    useState<(typeof settingKeys)[number]>("name");
  const ticket = useRef(0);
  useEffect(() => {
    document.title = "Portfolio CMS";
    let active = true;
    cmsApi
      .session()
      .then((result) => {
        if (active) {
          if (!result.authenticated) throw new Error("Access sign-in required");
          setSession("ready");
        }
      })
      .catch((e) => {
        if (active) {
          setSession("error");
          setError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function load(next = section, nextOffset = offset) {
    const current = ++ticket.current;
    setLoading(true);
    setError("");
    setEditing(null);
    setItems([]);
    setTotal(0);
    setDeleting(null);
    setDirty(false);
    try {
      if ("page" in next) {
        const page = next.page as Page;
        let data: RecordData,
          isNew = false;
        try {
          data = await cmsApi.get("content", page);
        } catch (e) {
          if (e instanceof AdminError && e.status === 404) {
            data = {
              id: page,
              section: page,
              content: structuredClone(pageTemplate(page)),
              is_published: 0,
              sort_order: 0,
            };
            isNew = true;
          } else throw e;
        }
        if (current === ticket.current)
          setEditing({ resource: "content", data, isNew });
      } else {
        const result = await cmsApi.list(next.resource, nextOffset);
        if (current === ticket.current) {
          setItems(result.items);
          setTotal(result.total);
        }
      }
    } catch (e) {
      if (current === ticket.current) report(e);
    } finally {
      if (current === ticket.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (session === "ready") void load(section, offset);
    return () => {
      ++ticket.current;
    };
  }, [section, offset, session]); // section changes are explicit and discard-confirmed
  function canLeave() {
    return !dirty || window.confirm("Discard unsaved changes?");
  }
  function update(data: RecordData) {
    setEditing((old) => (old ? { ...old, data } : old));
    setDirty(true);
    setNotice("");
  }
  async function open(resource: Resource, id: string) {
    if (!canLeave()) return;
    const current = ++ticket.current;
    setLoading(true);
    setEditing(null);
    setDirty(false);
    setError("");
    setNotice("");
    try {
      let data: RecordData,
        isNew = false;
      try {
        data = await cmsApi.get(resource, id);
      } catch (e) {
        if (
          resource === "content" &&
          e instanceof AdminError &&
          e.status === 404
        ) {
          data = {
            id,
            section: id,
            content: structuredClone(pageTemplate(id as Page)),
            is_published: 0,
            sort_order: 0,
          };
          isNew = true;
        } else throw e;
      }
      if (current === ticket.current) {
        setEditing({ resource, data, isNew });
        setDirty(false);
      }
    } catch (e) {
      if (current === ticket.current) report(e);
    } finally {
      if (current === ticket.current) setLoading(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await cmsApi.save(
        editing.resource,
        editing.data,
        editing.isNew,
      );
      setEditing({ ...editing, data: saved, isNew: false });
      setDirty(false);
      setNotice("Saved. Only published records are public.");
      if (!("page" in section)) {
        const result = await cmsApi.list(section.resource, offset);
        setItems(result.items);
        setTotal(result.total);
      }
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    setError("");
    try {
      await cmsApi.remove(deleting.resource, deleting.data);
      setDeleting(null);
      setNotice("Deleted.");
      await load();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  function choose(next: Section) {
    if (busy || !canLeave()) return;
    if (next === section && offset === 0) void load(next, 0);
    setOffset(0);
    setSection(next);
    setNotice("");
    setDeleting(null);
  }
  const login = `${ADMIN_API_URL}/admin/`;
  if (session !== "ready")
    return (
      <div className="cms-root">
        <main className="cms-signin">
          <h1>Portfolio CMS</h1>
          {session === "loading" ? (
            <p role="status">Checking your Cloudflare Access session…</p>
          ) : (
            <>
              <p role="alert">{error}</p>
              <a className="cms-primary" href={login}>
                Sign in with Cloudflare Access
              </a>
              <p>
                The secure dashboard opens on the Admin API origin so its
                authentication cookie stays first-party.
              </p>
              <button onClick={() => window.location.reload()}>
                Retry session
              </button>
            </>
          )}
        </main>
      </div>
    );
  const data = editing?.data;
  return (
    <div className="cms-root">
      <header className="cms-header">
        <a
          href={
            import.meta.env.VITE_SITE_URL || "https://kmuhammadali.github.io"
          }
          target="_blank"
          rel="noreferrer"
        >
          ↗ Public website
        </a>
        <strong>Portfolio CMS</strong>
        <a href={`${ADMIN_API_URL}/cdn-cgi/access/logout`}>Sign out</a>
      </header>
      <div className="cms-layout">
        <nav className="cms-nav" aria-label="CMS sections">
          {sections.map((item) => (
            <button
              key={item.name}
              aria-current={section.name === item.name ? "page" : undefined}
              disabled={busy}
              onClick={() => choose(item)}
            >
              {item.name}
            </button>
          ))}
        </nav>
        <main className="cms-main">
          <div className="cms-toolbar">
            <h1>{section.name}</h1>
            <button
              disabled={busy || loading}
              onClick={() => {
                if (canLeave()) void load();
              }}
            >
              Reload
            </button>
          </div>
          {error && (
            <div className="cms-error" role="alert">
              {error} {authError && <a href={login}>Sign in again</a>}
            </div>
          )}
          {notice && (
            <p className="cms-notice" role="status">
              {notice}
            </p>
          )}
          {loading && <p role="status">Loading…</p>}
          {!loading && !("page" in section) && (
            <section
              className="cms-panel"
              aria-label={`${section.name} records`}
            >
              <div className="cms-toolbar">
                <span>{total} records</span>
                <div className="cms-actions">
                  {section.resource === "skills" && (
                    <button
                      disabled={busy}
                      onClick={() => void open("content", "skills")}
                    >
                      Edit section intro
                    </button>
                  )}
                  {section.resource === "settings" ? (
                    <>
                      <label>
                        Setting{" "}
                        <select
                          value={settingKey}
                          disabled={busy}
                          onChange={(e) =>
                            setSettingKey(
                              e.target.value as (typeof settingKeys)[number],
                            )
                          }
                        >
                          {settingKeys.map((key) => (
                            <option key={key}>{key}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (canLeave()) {
                            setEditing({
                              resource: "settings",
                              isNew: true,
                              data: {
                                key: settingKey,
                                value: structuredClone(siteContent[settingKey]),
                              },
                            });
                            setDirty(false);
                            setError("");
                          }
                        }}
                      >
                        Create setting
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (canLeave()) {
                          setEditing({
                            resource: section.resource,
                            isNew: true,
                            data: newRecord(section.resource),
                          });
                          setDirty(false);
                          setError("");
                          setNotice("");
                        }
                      }}
                    >
                      Create {section.name.toLowerCase().replace(/s$/, "")}
                    </button>
                  )}
                </div>
              </div>
              <div className="cms-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title / key</th>
                      <th>Publication</th>
                      <th>Order</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={recordKey(section.resource, item)}>
                        <td>{recordTitle(item)}</td>
                        <td>
                          {section.resource === "settings"
                            ? "Public setting"
                            : item.status === "published" ||
                                item.is_published === 1
                              ? "Published"
                              : "Draft"}
                        </td>
                        <td>{String(item.sort_order ?? "—")}</td>
                        <td>
                          <button
                            disabled={busy}
                            aria-label={`Edit ${recordTitle(item)}`}
                            onClick={() =>
                              void open(
                                section.resource,
                                recordKey(section.resource, item),
                              )
                            }
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!items.length && <p>No records yet.</p>}
              <div className="cms-actions">
                <button
                  disabled={busy || offset === 0}
                  onClick={() => {
                    if (canLeave()) setOffset(Math.max(0, offset - 50));
                  }}
                >
                  Previous
                </button>
                <span>
                  {total ? offset + 1 : 0}–{Math.min(offset + 50, total)} of{" "}
                  {total}
                </span>
                <button
                  disabled={busy || offset + 50 >= total}
                  onClick={() => {
                    if (canLeave()) setOffset(offset + 50);
                  }}
                >
                  Next
                </button>
              </div>
            </section>
          )}
          {!loading && editing && data && (
            <form className="cms-panel" onSubmit={save} aria-busy={busy}>
              <h2>
                {editing.isNew
                  ? `Create ${editing.resource === "settings" ? "setting" : editing.resource === "media" ? "media record" : editing.resource === "content" ? "page" : editing.resource.slice(0, -1)}`
                  : `Edit ${recordTitle(data)}`}
              </h2>
              <fieldset disabled={busy} className="cms-editor">
                <label className="cms-field">
                  <span>
                    {editing.resource === "settings"
                      ? "Setting key"
                      : "Record ID"}
                  </span>
                  <input value={recordKey(editing.resource, data)} readOnly />
                </label>
                {editing.resource === "content" ? (
                  <>
                    <label className="cms-checkbox">
                      <input
                        type="checkbox"
                        checked={!!data.is_published}
                        onChange={(e) =>
                          update({
                            ...data,
                            is_published: e.target.checked ? 1 : 0,
                          })
                        }
                      />{" "}
                      Published
                    </label>
                    <p>
                      Unpublished or deleted pages use the website’s local
                      fallback; draft text is never public.
                    </p>
                    <JsonFields
                      value={data.content}
                      template={pageTemplate(String(data.id) as Page)}
                      path={String(data.id)}
                      onChange={(content) => update({ ...data, content })}
                    />
                  </>
                ) : editing.resource === "settings" ? (
                  <JsonFields
                    value={data.value}
                    template={
                      siteContent[
                        String(data.key) as (typeof settingKeys)[number]
                      ]
                    }
                    path={String(data.key)}
                    onChange={(value) => update({ ...data, value })}
                  />
                ) : (
                  <div className="cms-fields">
                    {entityFields[editing.resource]?.map((field) => {
                      const value = data[field];
                      const id = `record-${field}`;
                      if (field === "tags")
                        return (
                          <JsonFields
                            key={field}
                            value={value}
                            template={[""]}
                            path="tags"
                            onChange={(tags) => update({ ...data, tags })}
                          />
                        );
                      if (field === "is_published")
                        return (
                          <label className="cms-checkbox" key={field}>
                            <input
                              id={id}
                              type="checkbox"
                              checked={!!value}
                              onChange={(e) =>
                                update({
                                  ...data,
                                  [field]: e.target.checked ? 1 : 0,
                                })
                              }
                            />{" "}
                            Published
                          </label>
                        );
                      if (field === "status")
                        return (
                          <label className="cms-field" key={field} htmlFor={id}>
                            <span>Status</span>
                            <select
                              id={id}
                              value={String(value)}
                              onChange={(e) =>
                                update({
                                  ...data,
                                  status: e.target.value,
                                  published_at:
                                    e.target.value === "draft"
                                      ? null
                                      : data.published_at,
                                })
                              }
                            >
                              <option value="draft">Draft</option>
                              <option value="published">Published</option>
                            </select>
                          </label>
                        );
                      const multiline = [
                        "description",
                        "excerpt",
                        "content",
                      ].includes(field);
                      const display =
                        field === "tags"
                          ? (value as string[]).join(", ")
                          : String(value ?? "");
                      const change = (value: string) =>
                        update({
                          ...data,
                          [field]:
                            field === "tags"
                              ? value
                                  .split(",")
                                  .map((tag) => tag.trim())
                                  .filter(Boolean)
                              : ["sort_order", "file_size"].includes(field)
                                ? Number(value)
                                : field === "published_at"
                                  ? value || null
                                  : value,
                        });
                      return (
                        <label className="cms-field" key={field} htmlFor={id}>
                          <span>
                            {field.replaceAll("_", " ")}
                            {field === "tags" ? " (comma separated)" : ""}
                          </span>
                          {multiline ? (
                            <textarea
                              id={id}
                              rows={field === "content" ? 12 : 3}
                              value={display}
                              maxLength={field === "content" ? 100000 : 10000}
                              onChange={(e) => change(e.target.value)}
                            />
                          ) : (
                            <input
                              id={id}
                              type={
                                ["sort_order", "file_size"].includes(field)
                                  ? "number"
                                  : field.endsWith("_url")
                                    ? "url"
                                    : "text"
                              }
                              min={0}
                              value={display}
                              required={[
                                "title",
                                "slug",
                                "file_name",
                                "object_key",
                                "mime_type",
                              ].includes(field)}
                              onChange={(e) => change(e.target.value)}
                              placeholder={
                                field === "published_at"
                                  ? "Automatic on publish, or ISO timestamp"
                                  : field.endsWith("_url")
                                    ? "https://…"
                                    : undefined
                              }
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
                {editing.resource === "media" &&
                  typeof data.public_url === "string" &&
                  data.public_url.startsWith("https://") &&
                  String(data.mime_type).startsWith("image/") && (
                    <img
                      className="cms-preview"
                      referrerPolicy="no-referrer"
                      src={data.public_url}
                      alt={String(data.alt_text || "Media preview")}
                    />
                  )}
              </fieldset>
              <div className="cms-actions cms-save">
                <button className="cms-primary" type="submit" disabled={busy}>
                  {busy
                    ? "Saving…"
                    : editing.isNew
                      ? "Create record"
                      : "Save changes"}
                </button>
                {dirty && <span>Unsaved changes</span>}
                {!editing.isNew && (
                  <button
                    className="cms-danger"
                    type="button"
                    disabled={busy}
                    onClick={() => setDeleting(editing)}
                  >
                    Delete record
                  </button>
                )}
              </div>
            </form>
          )}
          {deleting && (
            <section
              className="cms-confirm"
              role="alertdialog"
              aria-modal="true"
              aria-label="Confirm deletion"
            >
              <h2>Delete {recordTitle(deleting.data)}?</h2>
              <p>
                This removes the database record. Media deletion removes
                metadata only.
              </p>
              <div className="cms-actions">
                <button
                  className="cms-danger"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  Confirm delete
                </button>
                <button disabled={busy} onClick={() => setDeleting(null)}>
                  Cancel
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

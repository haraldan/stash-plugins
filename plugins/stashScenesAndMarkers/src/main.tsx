// Stash Scenes and Markers
// A unified page that shows Scenes and Scene Markers together in one card grid.
// Markers used as ranges inside multi-scene videos serve the same purpose as
// scenes, so this view treats them as first-class "logical scenes".
//
// No npm React dependency: everything is taken off window.PluginApi at runtime.
// esbuild transforms JSX to React.createElement (see package.json build script).

/* eslint-disable @typescript-eslint/no-explicit-any */

const PluginApi: any = (window as any).PluginApi;
const React: any = PluginApi.React;

const { NavLink } = PluginApi.libraries.ReactRouterDOM;
const Bootstrap: any = PluginApi.libraries.Bootstrap;
const { Nav, Form, Button, Spinner } = Bootstrap;
const ReactFA: any = PluginApi.libraries.ReactFontAwesome;
const FontAwesomeSolid: any = PluginApi.libraries.FontAwesomeSolid || {};
const Apollo: any = PluginApi.libraries.Apollo || {};
const gql: any = Apollo.gql;
const useQuery: any = Apollo.useQuery;
// react-select's Select component may be the module default or the module itself.
const ReactSelect: any =
  PluginApi.libraries.ReactSelect?.default ?? PluginApi.libraries.ReactSelect;

const ROUTE = "/plugin/scenes-and-markers";
const DEFAULT_PAGE_SIZE = 100;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500];

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

// Markers query. Paged server-side (per_page is set per request) and sorted by
// the same key as scenes, so the two streams can be merged/interleaved without
// ever fetching the whole marker set. Fields mirror v0.31.1's SceneMarkerData
// fragment (the scene backref is what SceneMarkerCard renders and links from).
const FIND_ALL_MARKERS = gql && gql`
  query SnMFindAllMarkers(
    $filter: FindFilterType
    $scene_marker_filter: SceneMarkerFilterType
  ) {
    findSceneMarkers(filter: $filter, scene_marker_filter: $scene_marker_filter) {
      count
      scene_markers {
        id
        title
        seconds
        end_seconds
        stream
        preview
        screenshot
        created_at
        updated_at
        primary_tag {
          id
          name
        }
        tags {
          id
          name
        }
        scene {
          id
          title
          date
          created_at
          files {
            width
            height
            path
          }
          paths {
            screenshot
          }
          performers {
            id
            name
            image_path
          }
        }
      }
    }
  }
`;

const FIND_ALL_TAGS = gql && gql`
  query SnMFindAllTags($filter: FindFilterType) {
    findTags(filter: $filter) {
      tags {
        id
        name
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// A stable title for a marker, matching Stash's own `markerTitle` behaviour.
function markerTitle(marker: any): string {
  return marker.title || marker.primary_tag?.name || "";
}

// Extract the sort key from a unified item ("scene" | "marker"). Only used for
// the comparable sorts (created_at / title); "random" is handled separately by
// round-robin interleaving so it never calls this.
function keyOf(item: any, sortKey: string): string | null {
  if (item._kind === "scene") {
    const s = item.data;
    if (sortKey === "title") return (s.title || "").toLowerCase();
    return s.created_at ?? null; // "created_at"
  }
  const m = item.data;
  if (sortKey === "title") return markerTitle(m).toLowerCase();
  return m.created_at ?? null; // "created_at" — the marker's own add time
}

// Server sort string. Random uses a stable seed so pagination is consistent
// across "load more" (Stash's random_<seed> convention).
function sortParam(sort: string, seed: number): string {
  return sort === "random" ? `random_${seed}` : sort;
}

// Interleave two already-ordered streams. Append-stable: growing either input
// only extends the tail, so "load more" never reorders what's on screen.
function roundRobin(a: any[], b: any[]): any[] {
  const out: any[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

// Comparator producing the requested order. Nulls always sort last regardless
// of direction (mirrors Stash, where undated content trails).
function makeComparator(sortKey: string, direction: "ASC" | "DESC") {
  const mult = direction === "ASC" ? 1 : -1;
  return (a: any, b: any) => {
    const ka = keyOf(a, sortKey);
    const kb = keyOf(b, sortKey);
    if (ka == null && kb == null) return 0;
    if (ka == null) return 1;
    if (kb == null) return -1;
    if (ka < kb) return -1 * mult;
    if (ka > kb) return 1 * mult;
    return 0;
  };
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

// Minimal fallback card used only if Stash's own components are unavailable.
function SimpleCard({ href, image, title, subtitle, badge }: any) {
  return (
    <div className="snm-simple-card">
      <a href={href}>
        {image ? <img src={image} alt={title} loading="lazy" /> : null}
        <div className="snm-simple-card-body">
          {badge ? <span className="snm-badge">{badge}</span> : null}
          <div className="snm-simple-card-title">{title}</div>
          {subtitle ? (
            <div className="snm-simple-card-subtitle">{subtitle}</div>
          ) : null}
        </div>
      </a>
    </div>
  );
}

function ItemCard({ item }: any) {
  const components = PluginApi.components || {};
  if (item._kind === "scene") {
    const SceneCard = components.SceneCard;
    if (SceneCard) return <SceneCard scene={item.data} />;
    const s = item.data;
    return (
      <SimpleCard
        href={`/scenes/${s.id}`}
        image={s.paths?.screenshot}
        title={s.title || s.files?.[0]?.path || `Scene ${s.id}`}
      />
    );
  }
  // marker
  const SceneMarkerCard = components.SceneMarkerCard;
  if (SceneMarkerCard) return <SceneMarkerCard marker={item.data} />;
  const m = item.data;
  return (
    <SimpleCard
      href={`/scenes/${m.scene?.id}?t=${Math.floor(m.seconds)}`}
      image={m.screenshot || m.scene?.paths?.screenshot}
      title={markerTitle(m)}
      subtitle={m.scene?.title}
      badge="marker"
    />
  );
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

function FilterBar(props: any) {
  const { search, setSearch, tagIds, setTagIds, sort, setSort, direction, setDirection, dedup, setDedup, pageSize, setPageSize, onShuffle } = props;

  // Load all tags once for the selector (personal-library scale).
  const tagsResult = PluginApi.GQL?.useFindTagsQuery
    ? PluginApi.GQL.useFindTagsQuery({
        variables: { filter: { per_page: 1000, sort: "name", direction: "ASC" } },
      })
    : useQuery(FIND_ALL_TAGS, {
        variables: { filter: { per_page: 1000, sort: "name", direction: "ASC" } },
      });

  const tagOptions = React.useMemo(() => {
    const tags = tagsResult?.data?.findTags?.tags ?? [];
    return tags.map((t: any) => ({ value: t.id, label: t.name }));
  }, [tagsResult?.data]);

  const selectedTagOptions = React.useMemo(
    () => tagOptions.filter((o: any) => tagIds.includes(o.value)),
    [tagOptions, tagIds]
  );

  return (
    <div className="snm-filterbar">
      <Form.Control
        className="snm-search"
        type="text"
        placeholder="Search scenes & markers…"
        value={search}
        onChange={(e: any) => setSearch(e.target.value)}
      />

      <div className="snm-tagselect">
        {ReactSelect ? (
          <ReactSelect
            isMulti
            placeholder="Tags…"
            classNamePrefix="react-select"
            options={tagOptions}
            value={selectedTagOptions}
            onChange={(vals: any) =>
              setTagIds((vals || []).map((v: any) => v.value))
            }
          />
        ) : null}
      </div>

      <Form.Control
        as="select"
        className="snm-sort"
        value={sort}
        onChange={(e: any) => setSort(e.target.value)}
      >
        <option value="random">Random</option>
        <option value="created_at">Date added</option>
        <option value="title">Title</option>
      </Form.Control>

      {sort === "random" ? (
        <Button
          variant="secondary"
          className="snm-dir"
          onClick={onShuffle}
          title="Reshuffle"
        >
          ⟳
        </Button>
      ) : (
        <Button
          variant="secondary"
          className="snm-dir"
          onClick={() => setDirection(direction === "ASC" ? "DESC" : "ASC")}
          title="Toggle sort direction"
        >
          {direction === "ASC" ? "↑" : "↓"}
        </Button>
      )}

      <Form.Control
        as="select"
        className="snm-perpage"
        value={pageSize}
        onChange={(e: any) => setPageSize(Number(e.target.value))}
        title="Items per page"
      >
        {PAGE_SIZE_OPTIONS.map((n: number) => (
          <option key={n} value={n}>
            {n} / page
          </option>
        ))}
      </Form.Control>

      <Form.Check
        type="switch"
        id="snm-dedup"
        className="snm-dedup"
        label="Hide scenes with markers"
        checked={dedup}
        onChange={(e: any) => setDedup(e.target.checked)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function CombinedGrid() {
  const [search, setSearch] = React.useState("");
  const [tagIds, setTagIds] = React.useState<string[]>([]);
  const [sort, setSort] = React.useState("random");
  const [direction, setDirection] = React.useState<"ASC" | "DESC">("DESC");
  const [dedup, setDedup] = React.useState(true);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  // How many merged items to display. Starts at one page and grows on demand.
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  // Stable random seed so "random" paginates consistently. New order only on
  // mount or an explicit reshuffle.
  const [seed, setSeed] = React.useState(() => Math.floor(Math.random() * 1e9));

  const q = useDebounced(search, 300);

  const reshuffle = React.useCallback(() => {
    setSeed(Math.floor(Math.random() * 1e9));
    setLimit(pageSize);
  }, [pageSize]);

  // Reset the display window whenever the query shape or page size changes.
  React.useEffect(() => {
    setLimit(pageSize);
  }, [q, tagIds, sort, direction, dedup, pageSize]);

  const tagCriterion =
    tagIds.length > 0
      ? { value: tagIds, modifier: "INCLUDES", depth: -1 }
      : undefined;

  // Scenes: server-paged via an expanding window (per_page = limit).
  const scenesResult = PluginApi.GQL.useFindScenesQuery({
    variables: {
      filter: {
        q: q || undefined,
        page: 1,
        per_page: limit,
        sort: sortParam(sort, seed),
        direction,
      },
      scene_filter: {
        ...(tagCriterion ? { tags: tagCriterion } : {}),
        ...(dedup ? { has_markers: "false" } : {}),
      },
    },
    fetchPolicy: "cache-and-network",
  });

  // Markers: paged server-side with the same sort as scenes (never fetch all —
  // that hangs on large libraries).
  const markersResult = useQuery(FIND_ALL_MARKERS, {
    variables: {
      filter: {
        q: q || undefined,
        page: 1,
        per_page: limit,
        sort: sortParam(sort, seed),
        direction,
      },
      scene_marker_filter: tagCriterion ? { tags: tagCriterion } : {},
    },
    fetchPolicy: "cache-and-network",
  });

  const scenes = scenesResult?.data?.findScenes?.scenes ?? [];
  const sceneCount = scenesResult?.data?.findScenes?.count ?? 0;
  const markers = markersResult?.data?.findSceneMarkers?.scene_markers ?? [];
  const markerCount = markersResult?.data?.findSceneMarkers?.count ?? 0;

  const comparator = React.useMemo(
    () => makeComparator(sort, direction),
    [sort, direction]
  );

  // Both streams are paged to `limit` and server-sorted by the same key. For
  // the comparable sorts, merging the two windows and slicing to `limit` yields
  // the exact true top-`limit` (any item belonging there is within its own
  // stream's top `limit`, so it's loaded). For "random", the two server-random
  // windows are interleaved round-robin — append-stable across "load more".
  const merged = React.useMemo(() => {
    const sceneItems = scenes.map((s: any) => ({ _kind: "scene", data: s }));
    const markerItems = markers.map((m: any) => ({ _kind: "marker", data: m }));
    if (sort === "random") return roundRobin(sceneItems, markerItems);
    return [...sceneItems, ...markerItems].sort(comparator);
  }, [scenes, markers, sort, comparator]);

  const items = React.useMemo(() => merged.slice(0, limit), [merged, limit]);

  const totalCount = sceneCount + markerCount;
  const hasMore =
    merged.length > limit ||
    scenes.length < sceneCount ||
    markers.length < markerCount;
  const loading = scenesResult?.loading || markersResult?.loading;
  const error = scenesResult?.error || markersResult?.error;

  // Infinite-scroll sentinel.
  const sentinelRef = React.useRef<any>(null);
  React.useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !loading) {
        setLimit((l: number) => l + pageSize);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, pageSize]);

  return (
    <div className="snm-page">
      <h3 className="snm-title">Scenes &amp; Markers</h3>

      <FilterBar
        search={search}
        setSearch={setSearch}
        tagIds={tagIds}
        setTagIds={setTagIds}
        sort={sort}
        setSort={setSort}
        direction={direction}
        setDirection={setDirection}
        dedup={dedup}
        setDedup={setDedup}
        pageSize={pageSize}
        setPageSize={setPageSize}
        onShuffle={reshuffle}
      />

      <div className="snm-counts">
        Showing {items.length} of {totalCount} items · {sceneCount} scenes · {markerCount} markers
      </div>

      {error ? (
        <div className="snm-error">Error loading: {String(error.message || error)}</div>
      ) : null}

      <div className="row justify-content-center snm-grid">
        {items.map((item: any) => (
          <ItemCard key={`${item._kind}-${item.data.id}`} item={item} />
        ))}
      </div>

      {loading ? (
        <div className="snm-loading">
          <Spinner animation="border" role="status" />
        </div>
      ) : null}

      {hasMore ? (
        <div ref={sentinelRef} className="snm-sentinel">
          <Button variant="secondary" onClick={() => setLimit((l: number) => l + pageSize)}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// Gate rendering on Stash's Scenes chunk being loaded so SceneCard /
// SceneMarkerCard are registered in PluginApi.components.
function Page() {
  const loadable = PluginApi.loadableComponents || {};
  const [ready, setReady] = React.useState(false);

  // Trigger loading of the chunks that register SceneCard + TagSelect (Scenes)
  // and SceneMarkerCard (SceneMarkerList). We drive readiness off the
  // loadComponents promise rather than the useLoadComponents hook, whose "done"
  // signal proved unreliable (it left the page spinning forever even though the
  // components were already loaded). This promise resolves ~instantly.
  React.useEffect(() => {
    const toLoad = [loadable.Scenes, loadable.SceneMarkerList].filter(Boolean);
    let alive = true;
    const done = () => {
      if (alive) setReady(true);
    };
    try {
      const p = PluginApi.utils?.loadComponents?.(toLoad);
      if (p && typeof p.then === "function") p.then(done, done);
      else done();
    } catch (e) {
      done();
    }
    return () => {
      alive = false;
    };
  }, []);

  if (!gql || !useQuery) {
    return (
      <div className="snm-page">
        <div className="snm-error">
          This plugin requires Stash's Apollo library, which was not found on
          PluginApi.libraries. Your Stash version may be incompatible.
        </div>
      </div>
    );
  }

  // Render as soon as the components are loaded (or already present). The spinner
  // only shows on a cold start before loadComponents resolves.
  const componentsPresent = !!(
    PluginApi.components?.SceneCard && PluginApi.components?.SceneMarkerCard
  );
  if (!ready && !componentsPresent) {
    return (
      <div className="snm-loading">
        <Spinner animation="border" role="status" />
      </div>
    );
  }
  return <CombinedGrid />;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

PluginApi.register.route(ROUTE, Page);

// Nav item that mirrors Stash's own menu buttons: a `.minimal` Button (icon +
// label, vertically centered, hover-highlighted) inside a column Nav.Link.
// Markup/classes copied from Stash's MainNavbar menuItems mapping.
function NavButton() {
  const Icon = ReactFA?.FontAwesomeIcon;
  const icon = FontAwesomeSolid.faLayerGroup;
  return (
    <Nav.Link
      as="div"
      eventKey={ROUTE}
      className="col-4 col-sm-3 col-md-2 col-lg-auto"
    >
      <Button
        as={NavLink}
        to={ROUTE}
        className="minimal p-4 p-xl-2 d-flex d-xl-inline-block flex-column justify-content-between align-items-center"
      >
        {Icon && icon ? (
          <Icon
            icon={icon}
            className="nav-menu-icon d-block d-xl-inline mb-2 mb-xl-0"
          />
        ) : null}
        <span>Scenes+</span>
      </Button>
    </Nav.Link>
  );
}

PluginApi.patch.before("MainNavBar.MenuItems", function (props: any) {
  return [
    {
      children: (
        <>
          {props.children}
          <NavButton />
        </>
      ),
    },
  ];
});

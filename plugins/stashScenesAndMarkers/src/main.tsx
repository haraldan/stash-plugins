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
const Apollo: any = PluginApi.libraries.Apollo;
const { gql, useQuery } = Apollo;
// react-select's Select component may be the module default or the module itself.
const ReactSelect: any =
  PluginApi.libraries.ReactSelect?.default ?? PluginApi.libraries.ReactSelect;

const ROUTE = "/plugin/scenes-and-markers";
const PAGE_SIZE = 40;

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

// Markers query. We fetch ALL matching markers in one shot (per_page: -1) and
// sort/merge them client-side, because the server cannot sort markers by their
// parent scene's date. Fields mirror v0.31.1's SceneMarkerData fragment plus
// the parent scene's date/created_at needed for client-side sorting.
const FIND_ALL_MARKERS = gql`
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

const FIND_ALL_TAGS = gql`
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

// Extract the sort key from a unified item ("scene" | "marker").
function keyOf(item: any, sortKey: string): string | null {
  if (item._kind === "scene") {
    const s = item.data;
    if (sortKey === "title") return (s.title || "").toLowerCase();
    if (sortKey === "created_at") return s.created_at ?? null;
    return s.date ?? null; // "date"
  }
  // marker: fall back to the parent scene for date-like keys
  const m = item.data;
  if (sortKey === "title") return markerTitle(m).toLowerCase();
  if (sortKey === "created_at") return m.created_at ?? null;
  return m.scene?.date ?? m.scene?.created_at ?? null; // "date"
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
  const { search, setSearch, tagIds, setTagIds, sort, setSort, direction, setDirection, dedup, setDedup } = props;

  // Load all tags once for the selector (personal-library scale).
  const tagsResult = PluginApi.GQL?.useFindTagsQuery
    ? PluginApi.GQL.useFindTagsQuery({
        variables: { filter: { per_page: -1, sort: "name", direction: "ASC" } },
      })
    : useQuery(FIND_ALL_TAGS, {
        variables: { filter: { per_page: -1, sort: "name", direction: "ASC" } },
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
        <option value="date">Date</option>
        <option value="created_at">Created</option>
        <option value="title">Title</option>
      </Form.Control>

      <Button
        variant="secondary"
        className="snm-dir"
        onClick={() => setDirection(direction === "ASC" ? "DESC" : "ASC")}
        title="Toggle sort direction"
      >
        {direction === "ASC" ? "↑" : "↓"}
      </Button>

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
  const [sort, setSort] = React.useState("date");
  const [direction, setDirection] = React.useState<"ASC" | "DESC">("DESC");
  const [dedup, setDedup] = React.useState(true);
  const [limit, setLimit] = React.useState(PAGE_SIZE);

  const q = useDebounced(search, 300);

  // Reset the scene window whenever the query shape changes.
  React.useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [q, tagIds, sort, direction, dedup]);

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
        sort,
        direction,
      },
      scene_filter: {
        ...(tagCriterion ? { tags: tagCriterion } : {}),
        ...(dedup ? { has_markers: "false" } : {}),
      },
    },
    fetchPolicy: "cache-and-network",
  });

  // Markers: fetch all matching once.
  const markersResult = useQuery(FIND_ALL_MARKERS, {
    variables: {
      filter: { q: q || undefined, per_page: -1, sort: "created_at", direction: "DESC" },
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

  const items = React.useMemo(() => {
    const sceneItems = scenes.map((s: any) => ({ _kind: "scene", data: s }));
    let markerItems = markers.map((m: any) => ({ _kind: "marker", data: m }));
    markerItems.sort(comparator);

    const hasMoreScenes = scenes.length < sceneCount;
    if (hasMoreScenes && sceneItems.length > 0) {
      // Only emit markers that sort at or before the last loaded scene, so an
      // as-yet-unloaded scene can never appear out of order between them.
      const frontier = sceneItems[sceneItems.length - 1];
      markerItems = markerItems.filter(
        (m: any) => comparator(m, frontier) <= 0
      );
    }

    return [...sceneItems, ...markerItems].sort(comparator);
  }, [scenes, markers, sceneCount, comparator]);

  const hasMore = scenes.length < sceneCount;
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
        setLimit((l: number) => l + PAGE_SIZE);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading]);

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
      />

      <div className="snm-counts">
        {scenes.length} of {sceneCount} scenes · {markerCount} markers
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
          <Button variant="secondary" onClick={() => setLimit((l: number) => l + PAGE_SIZE)}>
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
  const toLoad = [loadable.Scenes].filter(Boolean);
  const componentsReady = PluginApi.hooks?.useLoadComponents
    ? PluginApi.hooks.useLoadComponents(toLoad)
    : true;

  if (!componentsReady) {
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

PluginApi.patch.before("MainNavBar.MenuItems", function (props: any) {
  return [
    {
      children: (
        <>
          {props.children}
          <Nav.Link as={NavLink} to={ROUTE} className="snm-navlink">
            Scenes+
          </Nav.Link>
        </>
      ),
    },
  ];
});

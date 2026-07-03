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

// Deterministic 32-bit hash (FNV-1a). Shuffles the scene+marker mix in a way
// that's stable for a given seed, so the random order doesn't change on
// re-render but does interleave the two kinds (not strict alternation).
function hash32(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Card sizing — replicated from Stash's GridCard so our mixed grid tiles into
// uniform rows exactly like the native scene/marker grids.
// ---------------------------------------------------------------------------

const ZOOM_WIDTHS = [280, 340, 480, 640];
const ZOOM_INDEX = 1; // typical default grid density

// Stash's calculateCardWidth (containerPadding 30, cardMargin 10).
function calculateCardWidth(containerWidth: number, preferredWidth: number): number {
  const containerPadding = 30;
  const cardMargin = 10;
  const maxUsableWidth = containerWidth - containerPadding;
  const maxElementsOnRow = Math.ceil(maxUsableWidth / preferredWidth);
  return maxUsableWidth / maxElementsOnRow - cardMargin;
}

function cardWidthFor(containerWidth: number, zoomIndex: number): number {
  const preferred = ZOOM_WIDTHS[zoomIndex] ?? ZOOM_WIDTHS[1];
  if (!containerWidth) return preferred;
  return calculateCardWidth(containerWidth, preferred);
}

// Measure the grid container width (ResizeObserver, 20px sensitivity like
// Stash's useContainerDimensions).
function useContainerWidth(): [any, number] {
  const ref = React.useRef<any>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries: any) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setWidth((prev: number) => (Math.abs(prev - w) > 20 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

// Minimal fallback card used only if Stash's own components are unavailable.
function SimpleCard({ href, image, title, subtitle, badge, width }: any) {
  return (
    <div className="snm-simple-card" style={width ? { width: `${width}px` } : undefined}>
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

function ItemCard({ item, width, zoomIndex }: any) {
  const components = PluginApi.components || {};
  if (item._kind === "scene") {
    const SceneCard = components.SceneCard;
    // SceneCard's width prop is `width`.
    if (SceneCard)
      return <SceneCard scene={item.data} width={width} zoomIndex={zoomIndex} />;
    const s = item.data;
    return (
      <SimpleCard
        href={`/scenes/${s.id}`}
        image={s.paths?.screenshot}
        title={s.title || s.files?.[0]?.path || `Scene ${s.id}`}
        width={width}
      />
    );
  }
  // marker
  const SceneMarkerCard = components.SceneMarkerCard;
  // SceneMarkerCard's width prop is `cardWidth` (differs from SceneCard).
  if (SceneMarkerCard)
    return <SceneMarkerCard marker={item.data} cardWidth={width} zoomIndex={zoomIndex} />;
  const m = item.data;
  return (
    <SimpleCard
      href={`/scenes/${m.scene?.id}?t=${Math.floor(m.seconds)}`}
      image={m.screenshot || m.scene?.paths?.screenshot}
      title={markerTitle(m)}
      subtitle={m.scene?.title}
      badge="marker"
      width={width}
    />
  );
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

function FilterBar(props: any) {
  const { search, setSearch, tagIds, setTagIds, dedup, setDedup, pageSize, setPageSize, onShuffle, excludeTagIds, setExcludeTagIds } = props;

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

  const selectedExcludeOptions = React.useMemo(
    () => tagOptions.filter((o: any) => excludeTagIds.includes(o.value)),
    [tagOptions, excludeTagIds]
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
            placeholder="Include tags…"
            classNamePrefix="react-select"
            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            styles={{ menuPortal: (base: any) => ({ ...base, zIndex: 9999 }) }}
            options={tagOptions}
            value={selectedTagOptions}
            onChange={(vals: any) =>
              setTagIds((vals || []).map((v: any) => v.value))
            }
          />
        ) : null}
      </div>

      <div className="snm-tagselect snm-tagselect-exclude">
        {ReactSelect ? (
          <ReactSelect
            isMulti
            placeholder="Exclude tags…"
            classNamePrefix="react-select"
            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            styles={{ menuPortal: (base: any) => ({ ...base, zIndex: 9999 }) }}
            options={tagOptions}
            value={selectedExcludeOptions}
            onChange={(vals: any) =>
              setExcludeTagIds((vals || []).map((v: any) => v.value))
            }
          />
        ) : null}
      </div>

      <Button
        variant="secondary"
        className="snm-shuffle"
        onClick={onShuffle}
        title="Reshuffle"
      >
        ⟳ Shuffle
      </Button>

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
// Pagination
// ---------------------------------------------------------------------------

function Pager({ page, totalPages, onPage }: any) {
  if (totalPages <= 1) return null;
  const go = (p: number) => onPage(Math.max(0, Math.min(totalPages - 1, p)));
  return (
    <div className="snm-pager">
      <Button variant="secondary" disabled={page <= 0} onClick={() => go(0)} title="First">
        «
      </Button>
      <Button variant="secondary" disabled={page <= 0} onClick={() => go(page - 1)} title="Previous">
        ‹
      </Button>
      <span className="snm-pageinfo">
        Page {page + 1} of {totalPages}
      </span>
      <Button
        variant="secondary"
        disabled={page >= totalPages - 1}
        onClick={() => go(page + 1)}
        title="Next"
      >
        ›
      </Button>
      <Button
        variant="secondary"
        disabled={page >= totalPages - 1}
        onClick={() => go(totalPages - 1)}
        title="Last"
      >
        »
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function CombinedGrid() {
  const [search, setSearch] = React.useState("");
  const [tagIds, setTagIds] = React.useState<string[]>([]);
  const [dedup, setDedup] = React.useState(true);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = React.useState(0);
  const [excludeTagIds, setExcludeTagIds] = React.useState<string[]>([]);
  // Server-side counts (lagged one render) used only to split each combined
  // page proportionally between the two streams.
  const [counts, setCounts] = React.useState({ s: 0, m: 0 });
  // Stable random seed so the random order is consistent within a browse
  // session; a new order only on mount or an explicit reshuffle.
  const [seed, setSeed] = React.useState(() => Math.floor(Math.random() * 1e9));

  const q = useDebounced(search, 300);

  // Measure the grid to size cards uniformly like the native grid.
  const [gridRef, containerWidth] = useContainerWidth();
  const cardWidth = React.useMemo(
    () => cardWidthFor(containerWidth, ZOOM_INDEX),
    [containerWidth]
  );

  const reshuffle = React.useCallback(() => {
    setSeed(Math.floor(Math.random() * 1e9));
    setPage(0);
  }, []);

  const goToPage = React.useCallback((p: number) => {
    setPage(p);
    window.scrollTo({ top: 0 });
  }, []);

  // Return to page 1 whenever the query shape or page size changes.
  React.useEffect(() => {
    setPage(0);
  }, [q, tagIds, excludeTagIds, dedup, pageSize, seed]);

  // Default: exclude the "VR" tag on first load (once). Looks up the tag id by
  // name; if there's no VR tag, nothing is excluded.
  const vrLookup = PluginApi.GQL.useFindTagsQuery({
    variables: { filter: { q: "VR", per_page: 25 } },
  });
  const defaultApplied = React.useRef(false);
  React.useEffect(() => {
    if (defaultApplied.current) return;
    const tags = vrLookup?.data?.findTags?.tags;
    if (!tags) return; // wait for the lookup to resolve
    defaultApplied.current = true;
    const vr = tags.find((t: any) => (t.name || "").toLowerCase() === "vr");
    if (vr) setExcludeTagIds([vr.id]);
  }, [vrLookup?.data]);

  // Combined include/exclude tag filter → one HierarchicalMultiCriterionInput.
  // Applies to scenes (their tags) and markers (primary_tag ∪ tags, unioned
  // server-side). `excludes` lets us include some tags and exclude others at
  // once; exclude-only uses the EXCLUDES modifier.
  const tagCriterion = React.useMemo(() => {
    const inc = tagIds;
    const exc = excludeTagIds;
    if (inc.length && exc.length)
      return { value: inc, excludes: exc, modifier: "INCLUDES", depth: -1 };
    if (inc.length) return { value: inc, modifier: "INCLUDES", depth: -1 };
    if (exc.length) return { value: exc, modifier: "EXCLUDES", depth: -1 };
    return undefined;
  }, [tagIds, excludeTagIds]);

  // Split each combined page proportionally between scenes and markers so a
  // page holds ~pageSize items and successive pages continue from each stream's
  // own offset. Only one page is fetched at a time (fast on large libraries).
  // Counts lag one render (`counts`); until known, fetch a half-page of each.
  const knownTotal = counts.s + counts.m;
  let scenesPerPage: number;
  let markersPerPage: number;
  if (knownTotal === 0) {
    scenesPerPage = Math.ceil(pageSize / 2);
    markersPerPage = pageSize - scenesPerPage;
  } else if (counts.s === 0) {
    scenesPerPage = 0;
    markersPerPage = pageSize;
  } else if (counts.m === 0) {
    scenesPerPage = pageSize;
    markersPerPage = 0;
  } else {
    scenesPerPage = Math.min(
      pageSize - 1,
      Math.max(1, Math.round((pageSize * counts.s) / knownTotal))
    );
    markersPerPage = pageSize - scenesPerPage;
  }

  // Always random, paginated server-side via a stable seed (Stash's
  // random_<seed>), so each page is a stable random slice of each stream.
  const randomSort = `random_${seed}`;

  const scenesResult = PluginApi.GQL.useFindScenesQuery({
    variables: {
      filter: {
        q: q || undefined,
        page: page + 1,
        per_page: Math.max(1, scenesPerPage),
        sort: randomSort,
      },
      scene_filter: {
        ...(tagCriterion ? { tags: tagCriterion } : {}),
        ...(dedup ? { has_markers: "false" } : {}),
      },
    },
    fetchPolicy: "cache-and-network",
  });

  const markersResult = useQuery(FIND_ALL_MARKERS, {
    variables: {
      filter: {
        q: q || undefined,
        page: page + 1,
        per_page: Math.max(1, markersPerPage),
        sort: randomSort,
      },
      scene_marker_filter: tagCriterion ? { tags: tagCriterion } : {},
    },
    fetchPolicy: "cache-and-network",
  });

  const scenes = scenesResult?.data?.findScenes?.scenes ?? [];
  const sceneCount = scenesResult?.data?.findScenes?.count ?? 0;
  const markers = markersResult?.data?.findSceneMarkers?.scene_markers ?? [];
  const markerCount = markersResult?.data?.findSceneMarkers?.count ?? 0;

  // Feed real counts back (lagged) so the next render splits pages by ratio.
  React.useEffect(() => {
    setCounts((prev) =>
      prev.s === sceneCount && prev.m === markerCount
        ? prev
        : { s: sceneCount, m: markerCount }
    );
  }, [sceneCount, markerCount]);

  // Interleave this page's scenes and markers into ONE randomized order (not
  // scene-marker alternation) via a seed-stable hash, so the mix looks random
  // but doesn't jump around on re-render.
  const items = React.useMemo(() => {
    const all = [
      ...scenes.map((s: any) => ({ _kind: "scene", data: s })),
      ...markers.map((m: any) => ({ _kind: "marker", data: m })),
    ];
    return all
      .map((it: any) => ({ it, h: hash32(`${seed}:${it._kind}:${it.data.id}`) }))
      .sort((a: any, b: any) => a.h - b.h)
      .map((x: any) => x.it);
  }, [scenes, markers, seed]);

  const totalCount = sceneCount + markerCount;
  const scenePages = scenesPerPage > 0 ? Math.ceil(sceneCount / scenesPerPage) : 0;
  const markerPages = markersPerPage > 0 ? Math.ceil(markerCount / markersPerPage) : 0;
  const totalPages = Math.max(1, scenePages, markerPages);
  const loading = scenesResult?.loading || markersResult?.loading;
  const error = scenesResult?.error || markersResult?.error;

  // Keep the page index in range if the total shrinks (e.g. after a filter).
  React.useEffect(() => {
    if (page > totalPages - 1) setPage(totalPages - 1);
  }, [totalPages, page]);

  // Keep the page index in range if the total shrinks (e.g. after a filter).
  React.useEffect(() => {
    if (page > totalPages - 1) setPage(totalPages - 1);
  }, [totalPages, page]);

  return (
    <div className="snm-page">
      <h3 className="snm-title">Scenes &amp; Markers</h3>

      <FilterBar
        search={search}
        setSearch={setSearch}
        tagIds={tagIds}
        setTagIds={setTagIds}
        dedup={dedup}
        setDedup={setDedup}
        pageSize={pageSize}
        setPageSize={setPageSize}
        onShuffle={reshuffle}
        excludeTagIds={excludeTagIds}
        setExcludeTagIds={setExcludeTagIds}
      />

      <div className="snm-counts">
        Page {page + 1} of {totalPages} · {totalCount} items ({sceneCount} scenes, {markerCount} markers)
      </div>

      <Pager page={page} totalPages={totalPages} onPage={goToPage} />

      {error ? (
        <div className="snm-error">Error loading: {String(error.message || error)}</div>
      ) : null}

      <div className="row justify-content-center snm-grid" ref={gridRef}>
        {items.map((item: any) => (
          <ItemCard
            key={`${item._kind}-${item.data.id}`}
            item={item}
            width={cardWidth}
            zoomIndex={ZOOM_INDEX}
          />
        ))}
      </div>

      {loading ? (
        <div className="snm-loading">
          <Spinner animation="border" role="status" />
        </div>
      ) : null}

      <Pager page={page} totalPages={totalPages} onPage={goToPage} />
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

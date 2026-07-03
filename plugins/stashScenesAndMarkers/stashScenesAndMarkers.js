(() => {
  // src/main.tsx
  var PluginApi = window.PluginApi;
  var React = PluginApi.React;
  var { NavLink } = PluginApi.libraries.ReactRouterDOM;
  var Bootstrap = PluginApi.libraries.Bootstrap;
  var { Nav, Form, Button, Spinner } = Bootstrap;
  var ReactFA = PluginApi.libraries.ReactFontAwesome;
  var FontAwesomeSolid = PluginApi.libraries.FontAwesomeSolid || {};
  var Apollo = PluginApi.libraries.Apollo || {};
  var gql = Apollo.gql;
  var useQuery = Apollo.useQuery;
  var ReactSelect = PluginApi.libraries.ReactSelect?.default ?? PluginApi.libraries.ReactSelect;
  var ROUTE = "/plugin/scenes-and-markers";
  var DEFAULT_PAGE_SIZE = 100;
  var PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500];
  var FIND_ALL_MARKERS = gql && gql`
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
  var FIND_ALL_TAGS = gql && gql`
  query SnMFindAllTags($filter: FindFilterType) {
    findTags(filter: $filter) {
      tags {
        id
        name
      }
    }
  }
`;
  function useDebounced(value, ms) {
    const [v, setV] = React.useState(value);
    React.useEffect(() => {
      const t = setTimeout(() => setV(value), ms);
      return () => clearTimeout(t);
    }, [value, ms]);
    return v;
  }
  function markerTitle(marker) {
    return marker.title || marker.primary_tag?.name || "";
  }
  function keyOf(item, sortKey) {
    if (item._kind === "scene") {
      const s = item.data;
      if (sortKey === "title") return (s.title || "").toLowerCase();
      return s.created_at ?? null;
    }
    const m = item.data;
    if (sortKey === "title") return markerTitle(m).toLowerCase();
    return m.created_at ?? null;
  }
  function sortParam(sort, seed) {
    return sort === "random" ? `random_${seed}` : sort;
  }
  function roundRobin(a, b) {
    const out = [];
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (i < a.length) out.push(a[i]);
      if (i < b.length) out.push(b[i]);
    }
    return out;
  }
  function makeComparator(sortKey, direction) {
    const mult = direction === "ASC" ? 1 : -1;
    return (a, b) => {
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
  var ZOOM_WIDTHS = [280, 340, 480, 640];
  var ZOOM_INDEX = 1;
  function calculateCardWidth(containerWidth, preferredWidth) {
    const containerPadding = 30;
    const cardMargin = 10;
    const maxUsableWidth = containerWidth - containerPadding;
    const maxElementsOnRow = Math.ceil(maxUsableWidth / preferredWidth);
    return maxUsableWidth / maxElementsOnRow - cardMargin;
  }
  function cardWidthFor(containerWidth, zoomIndex) {
    const preferred = ZOOM_WIDTHS[zoomIndex] ?? ZOOM_WIDTHS[1];
    if (!containerWidth) return preferred;
    return calculateCardWidth(containerWidth, preferred);
  }
  function useContainerWidth() {
    const ref = React.useRef(null);
    const [width, setWidth] = React.useState(0);
    React.useEffect(() => {
      const el = ref.current;
      if (!el || typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect?.width;
        if (w) setWidth((prev) => Math.abs(prev - w) > 20 ? w : prev);
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);
    return [ref, width];
  }
  function SimpleCard({ href, image, title, subtitle, badge, width }) {
    return /* @__PURE__ */ React.createElement("div", { className: "snm-simple-card", style: width ? { width: `${width}px` } : void 0 }, /* @__PURE__ */ React.createElement("a", { href }, image ? /* @__PURE__ */ React.createElement("img", { src: image, alt: title, loading: "lazy" }) : null, /* @__PURE__ */ React.createElement("div", { className: "snm-simple-card-body" }, badge ? /* @__PURE__ */ React.createElement("span", { className: "snm-badge" }, badge) : null, /* @__PURE__ */ React.createElement("div", { className: "snm-simple-card-title" }, title), subtitle ? /* @__PURE__ */ React.createElement("div", { className: "snm-simple-card-subtitle" }, subtitle) : null)));
  }
  function ItemCard({ item, width, zoomIndex }) {
    const components = PluginApi.components || {};
    if (item._kind === "scene") {
      const SceneCard = components.SceneCard;
      if (SceneCard)
        return /* @__PURE__ */ React.createElement(SceneCard, { scene: item.data, width, zoomIndex });
      const s = item.data;
      return /* @__PURE__ */ React.createElement(
        SimpleCard,
        {
          href: `/scenes/${s.id}`,
          image: s.paths?.screenshot,
          title: s.title || s.files?.[0]?.path || `Scene ${s.id}`,
          width
        }
      );
    }
    const SceneMarkerCard = components.SceneMarkerCard;
    if (SceneMarkerCard)
      return /* @__PURE__ */ React.createElement(SceneMarkerCard, { marker: item.data, cardWidth: width, zoomIndex });
    const m = item.data;
    return /* @__PURE__ */ React.createElement(
      SimpleCard,
      {
        href: `/scenes/${m.scene?.id}?t=${Math.floor(m.seconds)}`,
        image: m.screenshot || m.scene?.paths?.screenshot,
        title: markerTitle(m),
        subtitle: m.scene?.title,
        badge: "marker",
        width
      }
    );
  }
  function FilterBar(props) {
    const { search, setSearch, tagIds, setTagIds, sort, setSort, direction, setDirection, dedup, setDedup, pageSize, setPageSize, onShuffle } = props;
    const tagsResult = PluginApi.GQL?.useFindTagsQuery ? PluginApi.GQL.useFindTagsQuery({
      variables: { filter: { per_page: 1e3, sort: "name", direction: "ASC" } }
    }) : useQuery(FIND_ALL_TAGS, {
      variables: { filter: { per_page: 1e3, sort: "name", direction: "ASC" } }
    });
    const tagOptions = React.useMemo(() => {
      const tags = tagsResult?.data?.findTags?.tags ?? [];
      return tags.map((t) => ({ value: t.id, label: t.name }));
    }, [tagsResult?.data]);
    const selectedTagOptions = React.useMemo(
      () => tagOptions.filter((o) => tagIds.includes(o.value)),
      [tagOptions, tagIds]
    );
    return /* @__PURE__ */ React.createElement("div", { className: "snm-filterbar" }, /* @__PURE__ */ React.createElement(
      Form.Control,
      {
        className: "snm-search",
        type: "text",
        placeholder: "Search scenes & markers\u2026",
        value: search,
        onChange: (e) => setSearch(e.target.value)
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "snm-tagselect" }, ReactSelect ? /* @__PURE__ */ React.createElement(
      ReactSelect,
      {
        isMulti: true,
        placeholder: "Tags\u2026",
        classNamePrefix: "react-select",
        options: tagOptions,
        value: selectedTagOptions,
        onChange: (vals) => setTagIds((vals || []).map((v) => v.value))
      }
    ) : null), /* @__PURE__ */ React.createElement(
      Form.Control,
      {
        as: "select",
        className: "snm-sort",
        value: sort,
        onChange: (e) => setSort(e.target.value)
      },
      /* @__PURE__ */ React.createElement("option", { value: "random" }, "Random"),
      /* @__PURE__ */ React.createElement("option", { value: "created_at" }, "Date added"),
      /* @__PURE__ */ React.createElement("option", { value: "title" }, "Title")
    ), sort === "random" ? /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "secondary",
        className: "snm-dir",
        onClick: onShuffle,
        title: "Reshuffle"
      },
      "\u27F3"
    ) : /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "secondary",
        className: "snm-dir",
        onClick: () => setDirection(direction === "ASC" ? "DESC" : "ASC"),
        title: "Toggle sort direction"
      },
      direction === "ASC" ? "\u2191" : "\u2193"
    ), /* @__PURE__ */ React.createElement(
      Form.Control,
      {
        as: "select",
        className: "snm-perpage",
        value: pageSize,
        onChange: (e) => setPageSize(Number(e.target.value)),
        title: "Items per page"
      },
      PAGE_SIZE_OPTIONS.map((n) => /* @__PURE__ */ React.createElement("option", { key: n, value: n }, n, " / page"))
    ), /* @__PURE__ */ React.createElement(
      Form.Check,
      {
        type: "switch",
        id: "snm-dedup",
        className: "snm-dedup",
        label: "Hide scenes with markers",
        checked: dedup,
        onChange: (e) => setDedup(e.target.checked)
      }
    ));
  }
  function CombinedGrid() {
    const [search, setSearch] = React.useState("");
    const [tagIds, setTagIds] = React.useState([]);
    const [sort, setSort] = React.useState("random");
    const [direction, setDirection] = React.useState("DESC");
    const [dedup, setDedup] = React.useState(true);
    const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
    const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
    const [seed, setSeed] = React.useState(() => Math.floor(Math.random() * 1e9));
    const q = useDebounced(search, 300);
    const [gridRef, containerWidth] = useContainerWidth();
    const cardWidth = React.useMemo(
      () => cardWidthFor(containerWidth, ZOOM_INDEX),
      [containerWidth]
    );
    const reshuffle = React.useCallback(() => {
      setSeed(Math.floor(Math.random() * 1e9));
      setLimit(pageSize);
    }, [pageSize]);
    React.useEffect(() => {
      setLimit(pageSize);
    }, [q, tagIds, sort, direction, dedup, pageSize]);
    const tagCriterion = tagIds.length > 0 ? { value: tagIds, modifier: "INCLUDES", depth: -1 } : void 0;
    const scenesResult = PluginApi.GQL.useFindScenesQuery({
      variables: {
        filter: {
          q: q || void 0,
          page: 1,
          per_page: limit,
          sort: sortParam(sort, seed),
          direction
        },
        scene_filter: {
          ...tagCriterion ? { tags: tagCriterion } : {},
          ...dedup ? { has_markers: "false" } : {}
        }
      },
      fetchPolicy: "cache-and-network"
    });
    const markersResult = useQuery(FIND_ALL_MARKERS, {
      variables: {
        filter: {
          q: q || void 0,
          page: 1,
          per_page: limit,
          sort: sortParam(sort, seed),
          direction
        },
        scene_marker_filter: tagCriterion ? { tags: tagCriterion } : {}
      },
      fetchPolicy: "cache-and-network"
    });
    const scenes = scenesResult?.data?.findScenes?.scenes ?? [];
    const sceneCount = scenesResult?.data?.findScenes?.count ?? 0;
    const markers = markersResult?.data?.findSceneMarkers?.scene_markers ?? [];
    const markerCount = markersResult?.data?.findSceneMarkers?.count ?? 0;
    const comparator = React.useMemo(
      () => makeComparator(sort, direction),
      [sort, direction]
    );
    const merged = React.useMemo(() => {
      const sceneItems = scenes.map((s) => ({ _kind: "scene", data: s }));
      const markerItems = markers.map((m) => ({ _kind: "marker", data: m }));
      if (sort === "random") return roundRobin(sceneItems, markerItems);
      return [...sceneItems, ...markerItems].sort(comparator);
    }, [scenes, markers, sort, comparator]);
    const items = React.useMemo(() => merged.slice(0, limit), [merged, limit]);
    const totalCount = sceneCount + markerCount;
    const hasMore = merged.length > limit || scenes.length < sceneCount || markers.length < markerCount;
    const loading = scenesResult?.loading || markersResult?.loading;
    const error = scenesResult?.error || markersResult?.error;
    const sentinelRef = React.useRef(null);
    React.useEffect(() => {
      if (!hasMore) return;
      const el = sentinelRef.current;
      if (!el) return;
      const obs = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting) && !loading) {
          setLimit((l) => l + pageSize);
        }
      });
      obs.observe(el);
      return () => obs.disconnect();
    }, [hasMore, loading, pageSize]);
    return /* @__PURE__ */ React.createElement("div", { className: "snm-page" }, /* @__PURE__ */ React.createElement("h3", { className: "snm-title" }, "Scenes & Markers"), /* @__PURE__ */ React.createElement(
      FilterBar,
      {
        search,
        setSearch,
        tagIds,
        setTagIds,
        sort,
        setSort,
        direction,
        setDirection,
        dedup,
        setDedup,
        pageSize,
        setPageSize,
        onShuffle: reshuffle
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "snm-counts" }, "Showing ", items.length, " of ", totalCount, " items \xB7 ", sceneCount, " scenes \xB7 ", markerCount, " markers"), error ? /* @__PURE__ */ React.createElement("div", { className: "snm-error" }, "Error loading: ", String(error.message || error)) : null, /* @__PURE__ */ React.createElement("div", { className: "row justify-content-center snm-grid", ref: gridRef }, items.map((item) => /* @__PURE__ */ React.createElement(
      ItemCard,
      {
        key: `${item._kind}-${item.data.id}`,
        item,
        width: cardWidth,
        zoomIndex: ZOOM_INDEX
      }
    ))), loading ? /* @__PURE__ */ React.createElement("div", { className: "snm-loading" }, /* @__PURE__ */ React.createElement(Spinner, { animation: "border", role: "status" })) : null, hasMore ? /* @__PURE__ */ React.createElement("div", { ref: sentinelRef, className: "snm-sentinel" }, /* @__PURE__ */ React.createElement(Button, { variant: "secondary", onClick: () => setLimit((l) => l + pageSize) }, "Load more")) : null);
  }
  function Page() {
    const loadable = PluginApi.loadableComponents || {};
    const [ready, setReady] = React.useState(false);
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
      return /* @__PURE__ */ React.createElement("div", { className: "snm-page" }, /* @__PURE__ */ React.createElement("div", { className: "snm-error" }, "This plugin requires Stash's Apollo library, which was not found on PluginApi.libraries. Your Stash version may be incompatible."));
    }
    const componentsPresent = !!(PluginApi.components?.SceneCard && PluginApi.components?.SceneMarkerCard);
    if (!ready && !componentsPresent) {
      return /* @__PURE__ */ React.createElement("div", { className: "snm-loading" }, /* @__PURE__ */ React.createElement(Spinner, { animation: "border", role: "status" }));
    }
    return /* @__PURE__ */ React.createElement(CombinedGrid, null);
  }
  PluginApi.register.route(ROUTE, Page);
  function NavButton() {
    const Icon = ReactFA?.FontAwesomeIcon;
    const icon = FontAwesomeSolid.faLayerGroup;
    return /* @__PURE__ */ React.createElement(
      Nav.Link,
      {
        as: "div",
        eventKey: ROUTE,
        className: "col-4 col-sm-3 col-md-2 col-lg-auto"
      },
      /* @__PURE__ */ React.createElement(
        Button,
        {
          as: NavLink,
          to: ROUTE,
          className: "minimal p-4 p-xl-2 d-flex d-xl-inline-block flex-column justify-content-between align-items-center"
        },
        Icon && icon ? /* @__PURE__ */ React.createElement(
          Icon,
          {
            icon,
            className: "nav-menu-icon d-block d-xl-inline mb-2 mb-xl-0"
          }
        ) : null,
        /* @__PURE__ */ React.createElement("span", null, "Scenes+")
      )
    );
  }
  PluginApi.patch.before("MainNavBar.MenuItems", function(props) {
    return [
      {
        children: /* @__PURE__ */ React.createElement(React.Fragment, null, props.children, /* @__PURE__ */ React.createElement(NavButton, null))
      }
    ];
  });
})();

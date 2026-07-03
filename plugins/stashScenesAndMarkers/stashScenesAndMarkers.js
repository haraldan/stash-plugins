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
  var FIND_ALL_PERFORMERS = gql && gql`
  query SnMFindAllPerformers($filter: FindFilterType) {
    findPerformers(filter: $filter) {
      performers {
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
  function hash32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
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
    const { search, setSearch, tagIds, setTagIds, dedup, setDedup, pageSize, setPageSize, onShuffle, excludeTagIds, setExcludeTagIds, performerIds, setPerformerIds } = props;
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
    const selectedExcludeOptions = React.useMemo(
      () => tagOptions.filter((o) => excludeTagIds.includes(o.value)),
      [tagOptions, excludeTagIds]
    );
    const performersResult = useQuery(FIND_ALL_PERFORMERS, {
      variables: { filter: { per_page: 1e3, sort: "name", direction: "ASC" } }
    });
    const performerOptions = React.useMemo(() => {
      const ps = performersResult?.data?.findPerformers?.performers ?? [];
      return ps.map((p) => ({ value: p.id, label: p.name }));
    }, [performersResult?.data]);
    const selectedPerformerOptions = React.useMemo(
      () => performerOptions.filter((o) => performerIds.includes(o.value)),
      [performerOptions, performerIds]
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
        placeholder: "Include tags\u2026",
        classNamePrefix: "react-select",
        menuPortalTarget: typeof document !== "undefined" ? document.body : null,
        styles: { menuPortal: (base) => ({ ...base, zIndex: 9999 }) },
        options: tagOptions,
        value: selectedTagOptions,
        onChange: (vals) => setTagIds((vals || []).map((v) => v.value))
      }
    ) : null), /* @__PURE__ */ React.createElement("div", { className: "snm-tagselect snm-tagselect-exclude" }, ReactSelect ? /* @__PURE__ */ React.createElement(
      ReactSelect,
      {
        isMulti: true,
        placeholder: "Exclude tags\u2026",
        classNamePrefix: "react-select",
        menuPortalTarget: typeof document !== "undefined" ? document.body : null,
        styles: { menuPortal: (base) => ({ ...base, zIndex: 9999 }) },
        options: tagOptions,
        value: selectedExcludeOptions,
        onChange: (vals) => setExcludeTagIds((vals || []).map((v) => v.value))
      }
    ) : null), /* @__PURE__ */ React.createElement("div", { className: "snm-tagselect snm-performerselect" }, ReactSelect ? /* @__PURE__ */ React.createElement(
      ReactSelect,
      {
        isMulti: true,
        placeholder: "Performers\u2026",
        classNamePrefix: "react-select",
        menuPortalTarget: typeof document !== "undefined" ? document.body : null,
        styles: { menuPortal: (base) => ({ ...base, zIndex: 9999 }) },
        options: performerOptions,
        value: selectedPerformerOptions,
        onChange: (vals) => setPerformerIds((vals || []).map((v) => v.value))
      }
    ) : null), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "secondary",
        className: "snm-shuffle",
        onClick: onShuffle,
        title: "Reshuffle"
      },
      "\u27F3 Shuffle"
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
  function Pager({ page, totalPages, onPage }) {
    if (totalPages <= 1) return null;
    const go = (p) => onPage(Math.max(0, Math.min(totalPages - 1, p)));
    return /* @__PURE__ */ React.createElement("div", { className: "snm-pager" }, /* @__PURE__ */ React.createElement(Button, { variant: "secondary", disabled: page <= 0, onClick: () => go(0), title: "First" }, "\xAB"), /* @__PURE__ */ React.createElement(Button, { variant: "secondary", disabled: page <= 0, onClick: () => go(page - 1), title: "Previous" }, "\u2039"), /* @__PURE__ */ React.createElement("span", { className: "snm-pageinfo" }, "Page ", page + 1, " of ", totalPages), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "secondary",
        disabled: page >= totalPages - 1,
        onClick: () => go(page + 1),
        title: "Next"
      },
      "\u203A"
    ), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "secondary",
        disabled: page >= totalPages - 1,
        onClick: () => go(totalPages - 1),
        title: "Last"
      },
      "\xBB"
    ));
  }
  function CombinedGrid() {
    const [search, setSearch] = React.useState("");
    const [tagIds, setTagIds] = React.useState([]);
    const [performerIds, setPerformerIds] = React.useState([]);
    const [dedup, setDedup] = React.useState(true);
    const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
    const [page, setPage] = React.useState(0);
    const [excludeTagIds, setExcludeTagIds] = React.useState([]);
    const [counts, setCounts] = React.useState({ s: 0, m: 0 });
    const [seed, setSeed] = React.useState(() => Math.floor(Math.random() * 1e9));
    const q = useDebounced(search, 300);
    const [gridRef, containerWidth] = useContainerWidth();
    const cardWidth = React.useMemo(
      () => cardWidthFor(containerWidth, ZOOM_INDEX),
      [containerWidth]
    );
    const reshuffle = React.useCallback(() => {
      setSeed(Math.floor(Math.random() * 1e9));
      setPage(0);
    }, []);
    const goToPage = React.useCallback((p) => {
      setPage(p);
      window.scrollTo({ top: 0 });
    }, []);
    React.useEffect(() => {
      setPage(0);
    }, [q, tagIds, excludeTagIds, performerIds, dedup, pageSize, seed]);
    const vrLookup = PluginApi.GQL.useFindTagsQuery({
      variables: { filter: { q: "VR", per_page: 25 } }
    });
    const defaultApplied = React.useRef(false);
    React.useEffect(() => {
      if (defaultApplied.current) return;
      const tags = vrLookup?.data?.findTags?.tags;
      if (!tags) return;
      defaultApplied.current = true;
      const vr = tags.find((t) => (t.name || "").toLowerCase() === "vr");
      if (vr) setExcludeTagIds([vr.id]);
    }, [vrLookup?.data]);
    const tagCriterion = React.useMemo(() => {
      const inc = tagIds;
      const exc = excludeTagIds;
      if (inc.length && exc.length)
        return { value: inc, excludes: exc, modifier: "INCLUDES_ALL", depth: -1 };
      if (inc.length) return { value: inc, modifier: "INCLUDES_ALL", depth: -1 };
      if (exc.length) return { value: exc, modifier: "EXCLUDES", depth: -1 };
      return void 0;
    }, [tagIds, excludeTagIds]);
    const performerCriterion = React.useMemo(
      () => performerIds.length ? { value: performerIds, modifier: "INCLUDES_ALL" } : void 0,
      [performerIds]
    );
    const knownTotal = counts.s + counts.m;
    let scenesPerPage;
    let markersPerPage;
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
        Math.max(1, Math.round(pageSize * counts.s / knownTotal))
      );
      markersPerPage = pageSize - scenesPerPage;
    }
    const randomSort = `random_${seed}`;
    const scenesResult = PluginApi.GQL.useFindScenesQuery({
      variables: {
        filter: {
          q: q || void 0,
          page: page + 1,
          per_page: Math.max(1, scenesPerPage),
          sort: randomSort
        },
        scene_filter: {
          ...tagCriterion ? { tags: tagCriterion } : {},
          ...performerCriterion ? { performers: performerCriterion } : {},
          ...dedup ? { has_markers: "false" } : {}
        }
      },
      fetchPolicy: "cache-and-network"
    });
    const markersResult = useQuery(FIND_ALL_MARKERS, {
      variables: {
        filter: {
          q: q || void 0,
          page: page + 1,
          per_page: Math.max(1, markersPerPage),
          sort: randomSort
        },
        scene_marker_filter: {
          ...tagCriterion ? { tags: tagCriterion } : {},
          ...performerCriterion ? { performers: performerCriterion } : {}
        }
      },
      fetchPolicy: "cache-and-network"
    });
    const sceneData = scenesResult?.data ?? scenesResult?.previousData;
    const markerData = markersResult?.data ?? markersResult?.previousData;
    const scenes = sceneData?.findScenes?.scenes ?? [];
    const sceneCount = sceneData?.findScenes?.count ?? 0;
    const markers = markerData?.findSceneMarkers?.scene_markers ?? [];
    const markerCount = markerData?.findSceneMarkers?.count ?? 0;
    React.useEffect(() => {
      if (scenesResult?.loading || markersResult?.loading) return;
      if (!scenesResult?.data || !markersResult?.data) return;
      const s = scenesResult.data.findScenes?.count ?? 0;
      const m = markersResult.data.findSceneMarkers?.count ?? 0;
      setCounts((prev) => prev.s === s && prev.m === m ? prev : { s, m });
    }, [
      scenesResult?.data,
      markersResult?.data,
      scenesResult?.loading,
      markersResult?.loading
    ]);
    const items = React.useMemo(() => {
      const all = [
        ...scenes.map((s) => ({ _kind: "scene", data: s })),
        ...markers.map((m) => ({ _kind: "marker", data: m }))
      ];
      return all.map((it) => ({ it, h: hash32(`${seed}:${it._kind}:${it.data.id}`) })).sort((a, b) => a.h - b.h).map((x) => x.it);
    }, [scenes, markers, seed]);
    const totalCount = sceneCount + markerCount;
    const scenePages = scenesPerPage > 0 ? Math.ceil(sceneCount / scenesPerPage) : 0;
    const markerPages = markersPerPage > 0 ? Math.ceil(markerCount / markersPerPage) : 0;
    const totalPages = Math.max(1, scenePages, markerPages);
    const loading = scenesResult?.loading || markersResult?.loading;
    const error = scenesResult?.error || markersResult?.error;
    React.useEffect(() => {
      if (page > totalPages - 1) setPage(totalPages - 1);
    }, [totalPages, page]);
    return /* @__PURE__ */ React.createElement("div", { className: "snm-page" }, /* @__PURE__ */ React.createElement("h3", { className: "snm-title" }, "Scenes & Markers"), /* @__PURE__ */ React.createElement(
      FilterBar,
      {
        search,
        setSearch,
        tagIds,
        setTagIds,
        performerIds,
        setPerformerIds,
        dedup,
        setDedup,
        pageSize,
        setPageSize,
        onShuffle: reshuffle,
        excludeTagIds,
        setExcludeTagIds
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "snm-counts" }, "Page ", page + 1, " of ", totalPages, " \xB7 ", totalCount, " items (", sceneCount, " scenes, ", markerCount, " markers)"), /* @__PURE__ */ React.createElement(Pager, { page, totalPages, onPage: goToPage }), error ? /* @__PURE__ */ React.createElement("div", { className: "snm-error" }, "Error loading: ", String(error.message || error)) : null, /* @__PURE__ */ React.createElement("div", { className: "row justify-content-center snm-grid", ref: gridRef }, items.map((item) => /* @__PURE__ */ React.createElement(
      ItemCard,
      {
        key: `${item._kind}-${item.data.id}`,
        item,
        width: cardWidth,
        zoomIndex: ZOOM_INDEX
      }
    ))), loading ? /* @__PURE__ */ React.createElement("div", { className: "snm-loading" }, /* @__PURE__ */ React.createElement(Spinner, { animation: "border", role: "status" })) : null, /* @__PURE__ */ React.createElement(Pager, { page, totalPages, onPage: goToPage }));
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
            className: "nav-menu-icon d-block d-xl-inline mb-2 mb-xl-0 mr-xl-2 me-xl-2"
          }
        ) : null,
        /* @__PURE__ */ React.createElement("span", null, " Scenes+")
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

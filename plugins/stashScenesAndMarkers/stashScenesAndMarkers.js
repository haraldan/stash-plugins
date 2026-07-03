(() => {
  // src/main.tsx
  var PluginApi = window.PluginApi;
  var React = PluginApi.React;
  var { NavLink } = PluginApi.libraries.ReactRouterDOM;
  var Bootstrap = PluginApi.libraries.Bootstrap;
  var { Nav, Form, Button, Spinner } = Bootstrap;
  var Apollo = PluginApi.libraries.Apollo;
  var { gql, useQuery } = Apollo;
  var ReactSelect = PluginApi.libraries.ReactSelect?.default ?? PluginApi.libraries.ReactSelect;
  var ROUTE = "/plugin/scenes-and-markers";
  var PAGE_SIZE = 40;
  var FIND_ALL_MARKERS = gql`
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
  var FIND_ALL_TAGS = gql`
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
      if (sortKey === "created_at") return s.created_at ?? null;
      return s.date ?? null;
    }
    const m = item.data;
    if (sortKey === "title") return markerTitle(m).toLowerCase();
    if (sortKey === "created_at") return m.created_at ?? null;
    return m.scene?.date ?? m.scene?.created_at ?? null;
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
  function SimpleCard({ href, image, title, subtitle, badge }) {
    return /* @__PURE__ */ React.createElement("div", { className: "snm-simple-card" }, /* @__PURE__ */ React.createElement("a", { href }, image ? /* @__PURE__ */ React.createElement("img", { src: image, alt: title, loading: "lazy" }) : null, /* @__PURE__ */ React.createElement("div", { className: "snm-simple-card-body" }, badge ? /* @__PURE__ */ React.createElement("span", { className: "snm-badge" }, badge) : null, /* @__PURE__ */ React.createElement("div", { className: "snm-simple-card-title" }, title), subtitle ? /* @__PURE__ */ React.createElement("div", { className: "snm-simple-card-subtitle" }, subtitle) : null)));
  }
  function ItemCard({ item }) {
    const components = PluginApi.components || {};
    if (item._kind === "scene") {
      const SceneCard = components.SceneCard;
      if (SceneCard) return /* @__PURE__ */ React.createElement(SceneCard, { scene: item.data });
      const s = item.data;
      return /* @__PURE__ */ React.createElement(
        SimpleCard,
        {
          href: `/scenes/${s.id}`,
          image: s.paths?.screenshot,
          title: s.title || s.files?.[0]?.path || `Scene ${s.id}`
        }
      );
    }
    const SceneMarkerCard = components.SceneMarkerCard;
    if (SceneMarkerCard) return /* @__PURE__ */ React.createElement(SceneMarkerCard, { marker: item.data });
    const m = item.data;
    return /* @__PURE__ */ React.createElement(
      SimpleCard,
      {
        href: `/scenes/${m.scene?.id}?t=${Math.floor(m.seconds)}`,
        image: m.screenshot || m.scene?.paths?.screenshot,
        title: markerTitle(m),
        subtitle: m.scene?.title,
        badge: "marker"
      }
    );
  }
  function FilterBar(props) {
    const { search, setSearch, tagIds, setTagIds, sort, setSort, direction, setDirection, dedup, setDedup } = props;
    const tagsResult = PluginApi.GQL?.useFindTagsQuery ? PluginApi.GQL.useFindTagsQuery({
      variables: { filter: { per_page: -1, sort: "name", direction: "ASC" } }
    }) : useQuery(FIND_ALL_TAGS, {
      variables: { filter: { per_page: -1, sort: "name", direction: "ASC" } }
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
      /* @__PURE__ */ React.createElement("option", { value: "date" }, "Date"),
      /* @__PURE__ */ React.createElement("option", { value: "created_at" }, "Created"),
      /* @__PURE__ */ React.createElement("option", { value: "title" }, "Title")
    ), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "secondary",
        className: "snm-dir",
        onClick: () => setDirection(direction === "ASC" ? "DESC" : "ASC"),
        title: "Toggle sort direction"
      },
      direction === "ASC" ? "\u2191" : "\u2193"
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
    const [sort, setSort] = React.useState("date");
    const [direction, setDirection] = React.useState("DESC");
    const [dedup, setDedup] = React.useState(true);
    const [limit, setLimit] = React.useState(PAGE_SIZE);
    const q = useDebounced(search, 300);
    React.useEffect(() => {
      setLimit(PAGE_SIZE);
    }, [q, tagIds, sort, direction, dedup]);
    const tagCriterion = tagIds.length > 0 ? { value: tagIds, modifier: "INCLUDES", depth: -1 } : void 0;
    const scenesResult = PluginApi.GQL.useFindScenesQuery({
      variables: {
        filter: {
          q: q || void 0,
          page: 1,
          per_page: limit,
          sort,
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
        filter: { q: q || void 0, per_page: -1, sort: "created_at", direction: "DESC" },
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
    const items = React.useMemo(() => {
      const sceneItems = scenes.map((s) => ({ _kind: "scene", data: s }));
      let markerItems = markers.map((m) => ({ _kind: "marker", data: m }));
      markerItems.sort(comparator);
      const hasMoreScenes = scenes.length < sceneCount;
      if (hasMoreScenes && sceneItems.length > 0) {
        const frontier = sceneItems[sceneItems.length - 1];
        markerItems = markerItems.filter(
          (m) => comparator(m, frontier) <= 0
        );
      }
      return [...sceneItems, ...markerItems].sort(comparator);
    }, [scenes, markers, sceneCount, comparator]);
    const hasMore = scenes.length < sceneCount;
    const loading = scenesResult?.loading || markersResult?.loading;
    const error = scenesResult?.error || markersResult?.error;
    const sentinelRef = React.useRef(null);
    React.useEffect(() => {
      if (!hasMore) return;
      const el = sentinelRef.current;
      if (!el) return;
      const obs = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting) && !loading) {
          setLimit((l) => l + PAGE_SIZE);
        }
      });
      obs.observe(el);
      return () => obs.disconnect();
    }, [hasMore, loading]);
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
        setDedup
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "snm-counts" }, scenes.length, " of ", sceneCount, " scenes \xB7 ", markerCount, " markers"), error ? /* @__PURE__ */ React.createElement("div", { className: "snm-error" }, "Error loading: ", String(error.message || error)) : null, /* @__PURE__ */ React.createElement("div", { className: "row justify-content-center snm-grid" }, items.map((item) => /* @__PURE__ */ React.createElement(ItemCard, { key: `${item._kind}-${item.data.id}`, item }))), loading ? /* @__PURE__ */ React.createElement("div", { className: "snm-loading" }, /* @__PURE__ */ React.createElement(Spinner, { animation: "border", role: "status" })) : null, hasMore ? /* @__PURE__ */ React.createElement("div", { ref: sentinelRef, className: "snm-sentinel" }, /* @__PURE__ */ React.createElement(Button, { variant: "secondary", onClick: () => setLimit((l) => l + PAGE_SIZE) }, "Load more")) : null);
  }
  function Page() {
    const loadable = PluginApi.loadableComponents || {};
    const toLoad = [loadable.Scenes].filter(Boolean);
    const componentsReady = PluginApi.hooks?.useLoadComponents ? PluginApi.hooks.useLoadComponents(toLoad) : true;
    if (!componentsReady) {
      return /* @__PURE__ */ React.createElement("div", { className: "snm-loading" }, /* @__PURE__ */ React.createElement(Spinner, { animation: "border", role: "status" }));
    }
    return /* @__PURE__ */ React.createElement(CombinedGrid, null);
  }
  PluginApi.register.route(ROUTE, Page);
  PluginApi.patch.before("MainNavBar.MenuItems", function(props) {
    return [
      {
        children: /* @__PURE__ */ React.createElement(React.Fragment, null, props.children, /* @__PURE__ */ React.createElement(Nav.Link, { as: NavLink, to: ROUTE, className: "snm-navlink" }, "Scenes+"))
      }
    ];
  });
})();

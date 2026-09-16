// Stash Open In Player
// Adds a button to the scene card's popover button row that opens the scene's
// file in a video player on the machine browsing Stash.
//
// A page cannot start a process, and file:// navigation from an http:// page is
// blocked, so the click navigates to a custom URL scheme (default stashplay://)
// that the client OS is registered to hand to a small handler script. See
// client-setup/stashOpenInPlayer/README.md for the one-time client-side setup.
//
// No build step: everything comes off window.PluginApi at runtime and elements
// are built with React.createElement rather than JSX.

(function () {
  "use strict";

  const PluginApi = window.PluginApi;
  const React = PluginApi.React;
  const h = React.createElement;

  const Bootstrap = PluginApi.libraries.Bootstrap;
  const { Button, ButtonGroup } = Bootstrap;
  const ReactFA = PluginApi.libraries.ReactFontAwesome;
  const FontAwesomeSolid = PluginApi.libraries.FontAwesomeSolid || {};

  // Must match the plugin directory / yml basename: that is the key plugin
  // settings are stored under in configuration.plugins.
  const PLUGIN_ID = "stashOpenInPlayer";

  const DEFAULTS = {
    pathFrom: "",
    pathTo: "",
    toBackslashes: true,
    scheme: "stashplay",
  };

  // -------------------------------------------------------------------------
  // Path + URL
  // -------------------------------------------------------------------------

  // Rewrites the server-side path into the path the client machine sees.
  function mapPath(path, settings) {
    if (!path) return null;
    let out = path;
    if (settings.pathFrom && out.startsWith(settings.pathFrom)) {
      out = settings.pathTo + out.slice(settings.pathFrom.length);
    }
    if (settings.toBackslashes) {
      out = out.replace(/\//g, "\\");
    }
    return out;
  }

  // base64url, deliberately not percent-encoding: the Windows registry's
  // shell\open\command does %1-style substitution on the command string, so a
  // percent-encoded path (a space becomes %20) can be mangled on the way to the
  // handler. base64url contains no %, & or spaces and survives untouched.
  function b64url(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function buildUrl(path, settings) {
    const scheme = settings.scheme || DEFAULTS.scheme;
    return scheme + "://open/" + b64url(path);
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  // ConfigData includes `plugins`, so the stock Configuration query already
  // carries our yml-declared settings. Apollo caches it, so calling this once
  // per card costs one request in total, not one per card.
  function useSettings() {
    const query = PluginApi.GQL.useConfigurationQuery
      ? PluginApi.GQL.useConfigurationQuery()
      : undefined;
    const raw = query?.data?.configuration?.plugins?.[PLUGIN_ID];
    return React.useMemo(() => Object.assign({}, DEFAULTS, raw || {}), [raw]);
  }

  // -------------------------------------------------------------------------
  // Button
  // -------------------------------------------------------------------------

  function OpenInPlayerButton(props) {
    const settings = useSettings();
    const scene = props.scene;
    const path = mapPath(scene?.files?.[0]?.path, settings);

    if (!path) return null;

    const url = buildUrl(path, settings);
    const Icon = ReactFA?.FontAwesomeIcon;
    const icon = FontAwesomeSolid.faDesktop || FontAwesomeSolid.faExternalLinkAlt;

    function onClick(e) {
      // The popovers row sits outside the card's <Link>, so this is belt and
      // braces rather than load-bearing.
      e.preventDefault();
      e.stopPropagation();
      window.location.href = url;
    }

    return h(
      Button,
      {
        className: "minimal open-in-player-button",
        title: "Open in player: " + path,
        onClick: onClick,
      },
      Icon && icon ? h(Icon, { icon: icon }) : "▶"
    );
  }

  // -------------------------------------------------------------------------
  // Insertion into the card's popover button row
  // -------------------------------------------------------------------------

  // Rebuilds the element tree with `extra` appended to the children of the
  // element carrying the `card-popovers` class. Searching by class rather than
  // walking a fixed path keeps this working if the fragment nesting around the
  // ButtonGroup changes between Stash versions. Returns the input unchanged
  // (by identity) when no such element is present.
  function injectIntoPopovers(node, extra) {
    if (Array.isArray(node)) {
      let changed = false;
      const out = node.map(function (child) {
        const result = injectIntoPopovers(child, extra);
        if (result !== child) changed = true;
        return result;
      });
      return changed ? out : node;
    }

    if (!React.isValidElement(node)) return node;

    const className = node.props?.className;
    if (
      typeof className === "string" &&
      className.split(/\s+/).includes("card-popovers")
    ) {
      const children = React.Children.toArray(node.props.children);
      return React.cloneElement(node, null, children.concat(extra));
    }

    const children = node.props?.children;
    if (children == null) return node;

    const newChildren = injectIntoPopovers(children, extra);
    return newChildren === children
      ? node
      : React.cloneElement(node, null, newChildren);
  }

  PluginApi.patch.after("SceneCard.Popovers", function (props, result) {
    // The stock row is suppressed on compact cards; match that.
    if (props.compact) return result;

    const button = h(OpenInPlayerButton, { key: "oip", scene: props.scene });
    const injected = injectIntoPopovers(result, button);
    if (injected !== result) return injected;

    // No popover row was rendered: SceneCard.Popovers renders nothing at all
    // for a scene with no tags, performers, groups, markers, galleries,
    // o-counter or organized flag. Supply a row of our own that matches.
    return h(
      React.Fragment,
      null,
      result,
      h("hr", { key: "oip-hr" }),
      h(
        ButtonGroup,
        { key: "oip-group", className: "card-popovers open-in-player-fallback" },
        button
      )
    );
  });
})();

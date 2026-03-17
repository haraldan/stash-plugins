(function () {
    'use strict';

    const {
        stash,
        createElementFromHTML,
        waitForElementClass,
    } = window.stash7dJx1qP;

    async function getPerformerMarkersCount(performerId) {
        const reqData = {
            operationName: "FindSceneMarkers",
            variables: {
                scene_marker_filter: {
                    performers: {
                        value: [performerId],
                        modifier: "INCLUDES_ALL"
                    }
                }
            },
            query: `query FindSceneMarkers($filter: FindFilterType, $scene_marker_filter: SceneMarkerFilterType) {
                findSceneMarkers(filter: $filter, scene_marker_filter: $scene_marker_filter) {
                    count
                }
            }`
        };
        return await stash.callGQL(reqData);
    }

    const markersTabId = 'performer-details-tab-markers';

    function performerPageHandler() {
        waitForElementClass("nav-tabs", async function (className, el) {
            const navTabs = el.item(0);

            if (!document.getElementById(markersTabId)) {
                const markerTab = createElementFromHTML(
                    `<a id="${markersTabId}" href="#" role="tab" class="nav-item nav-link">
                        Markers
                        <span class="left-spacing badge badge-pill badge-secondary">0</span>
                    </a>`
                );

                navTabs.appendChild(markerTab);

                const performerId = window.location.pathname
                    .split('/')
                    .find((o, i, arr) => i > 1 && arr[i - 1] === 'performers');

                const response = await getPerformerMarkersCount(performerId);
                const markersCount = response?.data?.findSceneMarkers?.count || 0;
                document.querySelector(`#${markersTabId} span`).innerHTML = markersCount;

                // When clicking the tab, navigate to markers page and inject filter
                markerTab.addEventListener('click', async (e) => {
                    e.preventDefault();
                    window.location.href = `${window.location.origin}/scenes/markers`;

                    // Wait for markers page to load
                    const observer = new MutationObserver((mutations, obs) => {
                        const store = window.stash?.store;
                        if (store && document.querySelector('.scenes-markers-page')) {
                            // Dispatch the performer filter
                            store.dispatch({
                                type: "SET_MARKER_FILTER",
                                payload: {
                                    performers: {
                                        value: [performerId],
                                        modifier: "INCLUDES_ALL"
                                    }
                                }
                            });
                            obs.disconnect();
                        }
                    });

                    observer.observe(document.body, { childList: true, subtree: true });
                });
            }
        });
    }

    stash.addEventListener('page:performer:any', performerPageHandler);
    stash.addEventListener('page:performer:details', performerPageHandler);
})();

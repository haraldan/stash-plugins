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

                const performerName =
                    document.querySelector('.performer-head h2')?.innerText || '';

                // On click, navigate to markers and simulate UI interaction
                markerTab.addEventListener('click', async (e) => {
                    e.preventDefault();
                    window.location.href = `${window.location.origin}/scenes/markers`;

                    // Poll until the filter panel and performer list are ready
                    const interval = setInterval(() => {
                        const filterButton = document.querySelector(
                            '.scene-markers-filters-toggle'
                        );
                        const performerCheckbox = document.querySelector(
                            `.scene-marker-performers input[data-id="${performerId}"]`
                        );

                        if (filterButton && performerCheckbox) {
                            clearInterval(interval);

                            // Open filter panel
                            if (!filterButton.classList.contains('active')) {
                                filterButton.click();
                            }

                            // Check the performer
                            if (!performerCheckbox.checked) {
                                performerCheckbox.click();
                            }

                            // Apply the filter
                            const applyButton = document.querySelector(
                                '.scene-markers-filters-footer .btn-primary'
                            );
                            if (applyButton) applyButton.click();
                        }
                    }, 250);
                });
            }
        });
    }

    stash.addEventListener('page:performer:any', performerPageHandler);
    stash.addEventListener('page:performer:details', performerPageHandler);
})();

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

    function toBase64Utf8(str) {
        return btoa(
            encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
                String.fromCharCode('0x' + p1)
            )
        );
    }

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

                // Legacy filter structure required by Stash v0.30.1
                const filterObject = {
                    scene_marker_filter: {
                        performers: {
                            value: [performerId],
                            items: [{ id: performerId, label: performerName }],
                            modifier: "INCLUDES_ALL"
                        }
                    }
                };

                const jsonStr = JSON.stringify(filterObject);
                const base64Filter = toBase64Utf8(jsonStr);

                const markersUrl =
                    `${window.location.origin}/scenes/markers?c=${encodeURIComponent(base64Filter)}&sortby=created_at&sortdir=desc`;

                markerTab.href = markersUrl;
            }
        });
    }

    stash.addEventListener('page:performer:any', performerPageHandler);
    stash.addEventListener('page:performer:details', performerPageHandler);
})();

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

    // Converts performer into the tuple-style string used in working URLs
    function tupleEncodePerformer(performerId, performerName) {
        const items = `(("id":"${performerId}","label":"${performerName}"))`;
        return `(type:"performers",modifier:"INCLUDES_ALL",value:(items:${items},excluded:()))`;
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

                const performerName = document.querySelector('.performer-head h2')?.innerText || '';

                const response = await getPerformerMarkersCount(performerId);
                const markersCount = response?.data?.findSceneMarkers?.count || 0;
                document.querySelector(`#${markersTabId} span`).innerHTML = markersCount;

                // Create the tuple-style filter string
                const tupleFilter = tupleEncodePerformer(performerId, performerName);
                const encodedFilter = encodeURIComponent(tupleFilter);

                const markersUrl = `${window.location.origin}/scenes/markers?c=${encodedFilter}&sortby=created_at&sortdir=desc`;

                markerTab.href = markersUrl;
            }
        });
    }

    stash.addEventListener('page:performer:any', performerPageHandler);
    stash.addEventListener('page:performer:details', performerPageHandler);
})();

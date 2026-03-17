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

    // Generates the tuple-style filter string Stash expects
    function tupleEncodePerformer(performerId, performerName) {
        const encodedName = performerName.replace(/ /g, '%20'); // encode spaces
        return `(%22type%22:%22performers%22,%22modifier%22:%22INCLUDES_ALL%22,%22value%22:(%22items%22:%5B(%22id%22:%22${performerId}%22,%22label%22:%22${encodedName}%22)%5D,%22excluded%22:%5B%5D))`;
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

                const performerName =
                    document.querySelector('.performer-head h2')?.innerText || '';

                const response = await getPerformerMarkersCount(performerId);
                const markersCount = response?.data?.findSceneMarkers?.count || 0;
                document.querySelector(`#${markersTabId} span`).innerHTML = markersCount;

                // Generate the correct tuple-style filter URL
                const tupleFilter = tupleEncodePerformer(performerId, performerName);
                const markersUrl = `${window.location.origin}/scenes/markers?c=${tupleFilter}&sortby=created_at&sortdir=desc`;

                markerTab.href = markersUrl;
            }
        });
    }

    stash.addEventListener('page:performer:any', performerPageHandler);
    stash.addEventListener('page:performer:details', performerPageHandler);
})();

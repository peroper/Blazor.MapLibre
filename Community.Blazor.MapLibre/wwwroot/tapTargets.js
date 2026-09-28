// Picks what a tap on the map is about. A point wins over a line, a line over an area that fits under
// a finger, and that over a larger area; a smaller area drawn on top wins over a larger one. What
// loses is reached by tapping beside the winner or by zooming in. Uses the global turf.

export const defaultTapOptions = {
    // A square of 44 px around the tap, Apple's smallest touch target.
    reachTolerance: 22,
    underFingerTolerance: 10,
    smallAreaSize: 44
};

// queryRenderedFeatures needs a box with an area.
const areaTolerance = 0.5;

const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

const Kind = { point: 0, line: 1, smallArea: 2, area: 3 };

export function queryTapTargetsOnMap(map, point, options) {
    const queryOptions = { layers: options.layers };
    const queryAround = (dx, dy, tolerance) => distinctFeatures(queryIntersectingFeatures(map, [
        [point.x + dx - tolerance, point.y + dy - tolerance],
        [point.x + dx + tolerance, point.y + dy + tolerance]
    ], queryOptions));

    const boxes = screenBoxesAround(map, point, { ...defaultTapOptions, ...options }, queryOptions);
    const sizeOf = feature => {
        const box = boxes.get(keyOf(feature));
        return box && [box[2] - box[0], box[3] - box[1]];
    };

    const targets = resolveTapTargets(queryAround, { ...options, sizeOf });
    for (const feature of targets) {
        feature.geometry = null;
    }
    return targets;
}

// queryRenderedFeatures also returns polygons whose hole is under the box.
export function queryIntersectingFeatures(map, query, options) {
    const upperLeft = map.unproject([query[0][0], query[0][1]]);
    const bottomRight = map.unproject([query[1][0], query[1][1]]);
    const bboxPolygon = turf.bboxPolygon([upperLeft.lng, bottomRight.lat, bottomRight.lng, upperLeft.lat]);

    return map.queryRenderedFeatures(query, options)
        .filter(feature => turf.booleanIntersects(feature.geometry, bboxPolygon.geometry));
}

/** `queryAround(dx, dy, tolerance)` returns the features within `tolerance` px of the tap moved by (dx, dy), topmost first. */
export function resolveTapTargets(queryAround, options = {}) {
    const settings = { ...defaultTapOptions, ...options };
    const { reachTolerance, underFingerTolerance, sizeOf } = settings;
    const kindOf = feature => kindOfFeature(feature, settings);
    const ofKind = (features, kind) => features.filter(feature => kindOf(feature) === kind);

    const withinReach = queryAround(0, 0, reachTolerance);
    if (withinReach.length === 0) return [];

    const kind = Math.min(...withinReach.map(kindOf));

    if (kind === Kind.area) {
        const areas = foundElsewhere(ofKind(queryAround(0, 0, areaTolerance), Kind.area), queryAround, reachTolerance);
        return withoutOutranked(areas, (area, other) => area.foundAt.size < other.foundAt.size &&
            (area.feature.layer?.id !== other.feature.layer?.id || isSubset(area.foundAt, other.foundAt)));
    }

    const reachable = ofKind(withinReach, kind);

    if (kind === Kind.smallArea) {
        const underFinger = ofKind(queryAround(0, 0, areaTolerance), kind).map((feature, drawOrder) => {
            const [width, height] = sizeOf(feature);
            return { feature, drawOrder, size: width * height };
        });
        return underFinger.length === 0
            ? reachable
            : withoutOutranked(underFinger, (area, other) => area.size < other.size);
    }

    const underFinger = ofKind(queryAround(0, 0, underFingerTolerance), kind);
    return reachable.length > 1 && underFinger.length > 0 ? underFinger : reachable;
}

// The areas are tile pieces without their whole shape, so where else each one is found tells a smaller
// area from a larger one.
function foundElsewhere(areas, queryAround, reachTolerance) {
    const offsets = [2 * reachTolerance + 2, 4 * reachTolerance + 4, 8 * reachTolerance + 8]
        .flatMap(distance => directions.map(([x, y]) => [x * distance, y * distance]));
    const elsewhere = offsets.map(([dx, dy]) => new Set(queryAround(dx, dy, areaTolerance).map(keyOf)));

    return areas.map((feature, drawOrder) => ({
        feature,
        drawOrder,
        foundAt: new Set(elsewhere.flatMap((keys, index) => keys.has(keyOf(feature)) ? [index] : []))
    }));
}

// Neighbours in one layer, like two compartments at a border, beat each other only when one lies
// inside the other, or the side the finger landed on would not decide.
function isSubset(inner, outer) {
    return [...inner].every(index => outer.has(index));
}

function withoutOutranked(areas, isSmaller) {
    return areas
        .filter(area => !areas.some(other => isSmaller(other, area) && isOnTopOf(other, area)))
        .map(area => area.feature);
}

// A transparent layer, like one that only exists to be tapped, hides nothing under it.
function isOnTopOf(area, other) {
    return area.drawOrder < other.drawOrder || other.feature.layer?.paint?.['fill-opacity'] === 0;
}

function kindOfFeature(feature, { sizeOf, smallAreaSize }) {
    switch (feature.layer?.type) {
        case 'circle':
        case 'symbol':
        case 'heatmap':
            return Kind.point;
        case 'line':
            return Kind.line;
        default: {
            const size = sizeOf?.(feature);
            return size && size[0] <= smallAreaSize && size[1] <= smallAreaSize ? Kind.smallArea : Kind.area;
        }
    }
}

// Each feature's box on screen, over all its tile pieces. An area that is small near the tap lies whole
// within the margin, so a larger one cutting through it cannot look small.
function screenBoxesAround(map, point, { reachTolerance, smallAreaSize }, queryOptions) {
    const margin = reachTolerance + smallAreaSize;
    const pieces = map.queryRenderedFeatures([
        [point.x - margin, point.y - margin],
        [point.x + margin, point.y + margin]
    ], queryOptions);

    const boxes = new Map();
    for (const piece of pieces) {
        const [west, south, east, north] = turf.bbox(piece);
        const corners = [[west, north], [east, north], [east, south], [west, south]].map(corner => map.project(corner));
        const xs = corners.map(corner => corner.x);
        const ys = corners.map(corner => corner.y);
        const box = boxes.get(keyOf(piece)) ?? [Infinity, Infinity, -Infinity, -Infinity];

        boxes.set(keyOf(piece), [
            Math.min(box[0], ...xs), Math.min(box[1], ...ys), Math.max(box[2], ...xs), Math.max(box[3], ...ys)
        ]);
    }
    return boxes;
}

// A feature cut by tile borders comes back once per tile.
function distinctFeatures(features) {
    const seen = new Set();
    return features.filter(feature => {
        if (feature.properties?.id === undefined || feature.properties?.id === null) return true;
        if (seen.has(keyOf(feature))) return false;

        seen.add(keyOf(feature));
        return true;
    });
}

function keyOf(feature) {
    return `${feature.layer?.id}/${feature.properties?.id ?? JSON.stringify(feature.properties)}`;
}

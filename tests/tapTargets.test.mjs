// Run with: node --test tests/*.test.mjs
//
// Fakes in screen pixels with the tap at (0, 0): points are positions, lines and areas rectangles.
// A query returns what its box touches in the order given, which stands for the draw order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { queryTapTargetsOnMap, resolveTapTargets } from '../Community.Blazor.MapLibre/wwwroot/tapTargets.js';

globalThis.turf = createRequire(import.meta.url)('../Community.Blazor.MapLibre/wwwroot/turf/turf.min.js');

const everywhere = rect(-1000, -1000, 1000, 1000);

test('an observation on a compartment opens the observation', () => {
    assertIds(resolve(observation('windthrow', 2, 0), compartment('9', everywhere)), ['windthrow']);
});

test('a tap just beside the icon still opens the observation', () => {
    assertIds(resolve(observation('windthrow', 18, 0), compartment('9', everywhere)), ['windthrow']);
});

test('a tap out of reach of the observation opens the compartment', () => {
    assertIds(resolve(observation('windthrow', 30, 0), compartment('9', everywhere)), ['9']);
});

test('a tap near a compartment border opens only the compartment under the finger', () => {
    assertIds(resolve(
        compartment('9', rect(-1000, -1000, 6, 1000)),
        compartment('10', rect(6, -1000, 1000, 1000))), ['9']);
});

test('a tap right on a compartment border asks which one', () => {
    assertIds(resolve(
        compartment('9', rect(-1000, -1000, 0, 1000)),
        compartment('10', rect(0, -1000, 1000, 1000))), ['9', '10']);
});

test('two observations within reach open the one under the finger', () => {
    assertIds(resolve(
        observation('near', 4, 0),
        observation('farther', 20, 0),
        compartment('9', everywhere)), ['near']);
});

test('two observations within reach but not under the finger ask which one', () => {
    assertIds(resolve(
        observation('a', 14, 0),
        observation('b', 0, 20),
        compartment('9', everywhere)), ['a', 'b']);
});

test('two observations on top of each other ask which one', () => {
    assertIds(resolve(observation('a', 3, 0), observation('b', 5, 0)), ['a', 'b']);
});

test('an observation and a consideration point both under the finger ask which one', () => {
    assertIds(resolve(
        observation('windthrow', 4, 0),
        feature('artdata', 'artdata-point', 'circle', rect(6, 0, 6, 0)),
        compartment('9', everywhere)), ['windthrow', 'artdata']);
});

test('a line within reach wins over the area under it', () => {
    assertIds(resolve(
        feature('stonewall', 'sks_skoghistorialinje', 'line', rect(12, -1000, 13, 1000)),
        compartment('9', everywhere)), ['stonewall']);
});

test('a long line through a compartment is left for a tap beside it', () => {
    assertIds(resolve(
        feature('stonewall', 'sks_skoghistorialinje', 'line', rect(-200, 12, 3000, 13)),
        compartment('9', rect(-100, -100, 100, 100))), ['stonewall']);
});

test('a compartment covered by a line wherever it could be tapped is left for zooming in', () => {
    assertIds(resolve(
        feature('stonewall', 'sks_skoghistorialinje', 'line', rect(-3000, 12, 3000, 13)),
        compartment('9', rect(-3000, -2, 3000, 26))), ['stonewall']);
});

test('a point within reach wins over a line', () => {
    assertIds(resolve(
        feature('stonewall', 'sks_skoghistorialinje', 'line', rect(2, -1000, 3, 1000)),
        observation('windthrow', 15, 0)), ['windthrow']);
});

test('a small area hidden under the icon is left for zooming in', () => {
    assertIds(resolve(
        observation('windthrow', 2, 0),
        biotope(rect(1, -1, 3, 1)),
        compartment('9', everywhere)), ['windthrow']);
});

test('a small area that sticks out beside the icon is left for a tap there', () => {
    assertIds(resolve(
        observation('windthrow', 2, 0),
        biotope(rect(-15, -15, 15, 15)),
        compartment('9', everywhere)), ['windthrow']);
});

test('a compartment that is small at this zoom but reaches past the observation is left for a tap there', () => {
    assertIds(resolve(
        observation('windthrow', 18, 0),
        compartment('28', rect(-10, -27, 44, 27))), ['windthrow']);
});

test('a small area just beside the finger wins over the compartment under it', () => {
    assertIds(resolve(
        compartment('9', everywhere),
        feature('monument', 'raa_lamningar_polygon', 'fill', rect(12, -8, 28, 8))), ['monument']);
});

test('a small area out of reach leaves the compartment under the finger', () => {
    assertIds(resolve(
        compartment('9', everywhere),
        feature('monument', 'raa_lamningar_polygon', 'fill', rect(30, -8, 46, 8))), ['9']);
});

test('of two small areas within reach, the one under the finger wins', () => {
    assertIds(resolve(
        compartment('9', everywhere),
        feature('under', 'raa_lamningar_polygon', 'fill', rect(-8, -8, 8, 8)),
        feature('beside', 'sks_skoghistoriayta', 'fill', rect(12, -8, 28, 8))), ['under']);
});

test('a small area that reaches past the observation is left for a tap there', () => {
    assertIds(resolve(
        observation('windthrow', 0, 0),
        compartment('9', everywhere),
        feature('monument', 'raa_lamningar_polygon', 'fill', rect(-4, -8, 40, 8))), ['windthrow']);
});

test('small compartments at low zoom: the one under the finger opens', () => {
    assertIds(resolve(
        compartment('27', rect(-30, -20, 5, 20)),
        compartment('28', rect(5, -20, 40, 20))), ['27']);
});

test('a larger area under an observation is left for a tap next to it', () => {
    assertIds(resolve(
        observation('windthrow', 2, 0),
        biotope(rect(-100, -100, 100, 100)),
        compartment('9', everywhere)), ['windthrow']);
});

test('an area drawn on top of a larger visible area wins over it', () => {
    assertIds(resolve(biotope(rect(-60, -60, 60, 60)), reserve(everywhere)), ['biotope']);
});

test('an area drawn under a larger visible area asks which one', () => {
    assertIds(resolve(reserve(everywhere), biotope(rect(-60, -60, 60, 60))), ['reserve', 'biotope']);
});

test('an area inside a compartment wins over the compartment', () => {
    assertIds(resolve(compartment('9', everywhere), biotope(rect(-60, -60, 60, 60))), ['biotope']);
});

test('a small area inside a compartment wins over the compartment', () => {
    assertIds(resolve(compartment('9', everywhere), biotope(rect(-20, -20, 20, 20))), ['biotope']);
});

test('two areas that cover the same spots ask which one', () => {
    assertIds(resolve(compartment('9', everywhere), biotope(everywhere)), ['9', 'biotope']);
});

test('a small area across a compartment border still wins over the compartment under the finger', () => {
    assertIds(resolve(
        compartment('90', rect(-1000, -1000, 1000, 30)),
        compartment('94', rect(-1000, 30, 1000, 1000)),
        feature('monument', 'raa_lamningar_polygon', 'fill', rect(-20, -20, 20, 60))), ['monument']);
});

test('a tap right on the border of a small compartment asks which one', () => {
    assertIds(resolve(
        compartment('9', rect(-1000, -1000, 0, 1000)),
        compartment('10', rect(0, -1000, 60, 1000))), ['9', '10']);
});

test('a smaller area drawn under a larger visible one that it only partly covers asks which one', () => {
    assertIds(resolve(
        reserve(rect(-1000, -1000, 1000, 1000)),
        biotope(rect(-60, -60, 1000, 60))), ['reserve', 'biotope']);
});

test('an area within reach but not under the finger opens nothing', () => {
    assertIds(resolve(compartment('9', rect(10, -1000, 1000, 1000))), []);
});

test('nothing within reach opens nothing', () => {
    assertIds(resolve(), []);
});

test('an unknown layer type counts as an area', () => {
    assertIds(resolve(
        feature('hill', 'terrain', 'fill-extrusion-next', everywhere),
        observation('windthrow', 3, 0)), ['windthrow']);
});

test('the tolerances can be set by the caller', () => {
    const fakes = [observation('windthrow', 18, 0), compartment('9', everywhere)];
    const result = resolveTapTargets(queryOver(fakes), { ...helpersOver(fakes), reachTolerance: 10 });

    assertIds(result, ['9']);
});

test('of two small areas under the finger, the smaller one drawn on top wins', () => {
    assertIds(resolve(
        compartment('9', everywhere),
        feature('monument', 'raa_lamningar_polygon', 'fill', rect(-5, -5, 5, 5)),
        feature('swamp', 'sks_sumpskog', 'fill', rect(-20, -20, 20, 20))), ['monument']);
});

test('of two small areas under the finger, a smaller one drawn under a visible one asks which one', () => {
    assertIds(resolve(
        compartment('9', everywhere),
        feature('swamp', 'sks_sumpskog', 'fill', rect(-20, -20, 20, 20)),
        feature('monument', 'raa_lamningar_polygon', 'fill', rect(-5, -5, 5, 5))), ['swamp', 'monument']);
});

test('a small area drawn under a larger visible area asks which one', () => {
    assertIds(resolve(reserve(everywhere), biotope(rect(-20, -20, 20, 20))), ['reserve', 'biotope']);
});

test('a small area beside the finger drawn under a larger visible area asks which one', () => {
    assertIds(resolve(reserve(everywhere), biotope(rect(12, -8, 28, 8))), ['reserve', 'biotope']);
});

test('a small area drawn on top of a larger visible area wins over it', () => {
    assertIds(resolve(biotope(rect(-20, -20, 20, 20)), reserve(everywhere)), ['biotope']);
});

test('the reach is a square around the tap', () => {
    assertIds(resolve(observation('windthrow', 22, 22), compartment('9', everywhere)), ['windthrow']);
    assertIds(resolve(observation('windthrow', 23, 0), compartment('9', everywhere)), ['9']);
});

test('on the map, a tap in the hole of a compartment does not hit it', () => {
    const donut = mapFeature('9', 'compartmentQuery', 'fill',
        [ring(-100, -100, 100, 100), ring(-20, -20, 20, 20)], { 'fill-opacity': 0 });

    assertIds(tapOnMap([donut], { x: 0, y: 0 }), []);
    assertIds(tapOnMap([donut], { x: 60, y: 0 }), ['9']);
});

test('on the map, an area cut into tile pieces is measured as a whole', () => {
    const pieces = [ring(-40, -20, -1, 20), ring(-1, -20, 40, 20)]
        .map(piece => mapFeature('wetland', 'sks_sumpskog', 'fill', [piece]));
    const monument = mapFeature('monument', 'raa_lamningar_polygon', 'fill', [ring(40, -5, 50, 5)]);

    assertIds(tapOnMap([monument, ...pieces], { x: 30, y: 0 }), ['monument']);
});

test('on the map, a feature listed once per tile is one choice', () => {
    const point = () => mapFeature('windthrow', 'observationQuery', 'circle', null, undefined, [2, 0]);

    assertIds(tapOnMap([point(), point()], { x: 0, y: 0 }), ['windthrow']);
});

test('on the map, a point with only a MapLibre id listed once per tile is one choice', () => {
    const point = () => ({ ...mapFeature(null, 'observationQuery', 'circle', null, undefined, [2, 0]), id: 42, properties: {} });

    assert.equal(tapOnMap([point(), point()], { x: 0, y: 0 }).length, 1);
});

test('on the map, a point without an id listed once per tile is one choice', () => {
    const point = () => ({ ...mapFeature(null, 'sks_skoghistoriapunkt', 'circle', null, undefined, [2, 0]), properties: { ogc_fid: 9 } });

    assert.equal(tapOnMap([point(), point()], { x: 0, y: 0 }).length, 1);
});

test('on the map, a tap on a tile border in an area without an id is one choice', () => {
    const pieces = [ring(-400, -400, 0, 400), ring(0, -400, 400, 400)]
        .map(piece => ({ ...mapFeature(null, 'sks_sumpskog', 'fill', [piece]), properties: { ogc_fid: 7 } }));

    assert.equal(tapOnMap(pieces, { x: 0, y: 0 }).length, 1);
});

test('on the map, features without an id share an ogc_fid only within their own layer', () => {
    const swamp = { ...mapFeature(null, 'sks_sumpskog', 'fill', [ring(-400, -400, 400, 400)]), properties: { ogc_fid: 7 } };
    const biotope = { ...mapFeature(null, 'sks_nyckelbiotop', 'fill', [ring(-400, -400, 400, 400)]), properties: { ogc_fid: 7 } };

    assert.equal(tapOnMap([swamp, biotope], { x: 0, y: 0 }).length, 2);
});

test('on the map, the winners come back without geometries', () => {
    const [target] = tapOnMap([mapFeature('windthrow', 'observationQuery', 'circle', null, undefined, [2, 0])], { x: 0, y: 0 });

    assert.equal(target.geometry, null);
});

function tapOnMap(features, point) {
    const layers = [...new Set(features.map(feature => feature.layer.id))];
    return queryTapTargetsOnMap(fakeMap(features), point, { layers });
}

// Screen y grows downwards, so it is stored as negative latitude.
function fakeMap(features) {
    return {
        project: ([lng, lat]) => ({ x: lng, y: -lat }),
        unproject: ([x, y]) => ({ lng: x, lat: -y }),
        queryRenderedFeatures: ([[x0, y0], [x1, y1]], { layers }) => features
            .filter(feature => layers.includes(feature.layer.id))
            .filter(feature => {
                const [west, south, east, north] = turf.bbox(feature);
                return touches(rect(west, -north, east, -south), rect(x0, y0, x1, y1));
            })
            .map(feature => structuredClone(feature))
    };
}

function mapFeature(id, layerId, type, rings, paint, position) {
    const geometry = position
        ? { type: 'Point', coordinates: [position[0], -position[1]] }
        : { type: 'Polygon', coordinates: rings };
    return { type: 'Feature', geometry, properties: { id }, layer: { id: layerId, type, paint } };
}

function ring(minX, minY, maxX, maxY) {
    return [[minX, -minY], [maxX, -minY], [maxX, -maxY], [minX, -maxY], [minX, -minY]];
}

function resolve(...fakes) {
    return resolveTapTargets(queryOver(fakes), helpersOver(fakes));
}

function helpersOver(fakes) {
    const shapeOf = feature => fakes.find(fake => fake.feature === feature).shape;
    return {
        sizeOf: feature => {
            const shape = shapeOf(feature);
            return [shape.maxX - shape.minX, shape.maxY - shape.minY];
        }
    };
}

function queryOver(fakes) {
    return (dx, dy, tolerance) => fakes
        .filter(fake => touches(fake.shape, rect(dx - tolerance, dy - tolerance, dx + tolerance, dy + tolerance)))
        .map(fake => fake.feature);
}

function assertIds(features, expected) {
    assert.deepEqual(features.map(feature => feature.properties.id).sort(), [...expected].sort());
}

function observation(id, x, y) {
    return feature(id, 'observationQuery', 'circle', rect(x, y, x, y));
}

function compartment(id, shape) {
    return feature(id, 'compartmentQuery', 'fill', shape, { 'fill-opacity': 0 });
}

function reserve(shape) {
    return feature('reserve', 'nvr_naturreservat', 'fill', shape);
}

function biotope(shape) {
    return feature('biotope', 'sks_nyckelbiotop', 'fill', shape);
}

function feature(id, layerId, layerType, shape, paint) {
    return { feature: { layer: { id: layerId, type: layerType, paint }, properties: { id } }, shape };
}

function rect(minX, minY, maxX, maxY) {
    return { minX, minY, maxX, maxY };
}

function touches(a, b) {
    return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

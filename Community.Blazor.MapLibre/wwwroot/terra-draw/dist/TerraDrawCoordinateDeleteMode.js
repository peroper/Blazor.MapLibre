/**
 * TerraDrawCoordinateDeleteMode v1.0.0
 * Custom TerraDraw mode for deleting coordinates by clicking/tapping
 *
 * Usage:
 *   <script src="terra-draw.umd.js"></script>
 *   <script src="TerraDrawCoordinateDeleteMode.umd.js"></script>
 *
 *   const deleteMode = new TerraDrawCoordinateDeleteMode({ ... });
 */
var TerraDrawCoordinateDeleteModeUmd = (function () {
    'use strict';

    function TerraDrawCoordinateDeleteMode(options) {
        options = options || {};

        this._mode = 'delete';
        this._state = 'unregistered';
        this._pointerDistance = options.pointerDistance || 40;

        this._styles = {
            deletePointColor: '#DC2626',
            deletePointWidth: 6,
            highlightColor: '#FCA5A5',
            featureOutlineColor: '#EF4444',
            featureOutlineWidth: 3,
            featureFillColor: '#FEE2E2',
            featureFillOpacity: 0.25,
            lineStringColor: '#EF4444',
            lineStringWidth: 3,
            pointColor: '#EF4444',
            pointWidth: 10,
            pointOutlineColor: '#7F1D1D',
            pointOutlineWidth: 2
        };

        if (options.styles) {
            for (var key in options.styles) {
                if (options.styles.hasOwnProperty(key)) {
                    this._styles[key] = options.styles[key];
                }
            }
        }

        this._deletePoints = [];
        this._hoveredDeletePointId = null;
        this._hoveredFeatureId = null;
        this._onCoordinateDeleted = options.onCoordinateDeleted || null;
        this._onFeatureDeleted = options.onFeatureDeleted || null;

        console.log('[TerraDrawCoordinateDeleteMode] Initialized');
    }

    Object.defineProperty(TerraDrawCoordinateDeleteMode.prototype, 'mode', {
        get: function() { return this._mode; },
        set: function(value) { this._mode = value; }
    });

    TerraDrawCoordinateDeleteMode.prototype.register = function(config) {
        this._store = config.store;
        this._project = config.project;
        this._unproject = config.unproject;
        this._setCursor = config.setCursor;
        this._onChange = config.onChange;
        this._onFinish = config.onFinish;
        this._state = 'registered';
        console.log('[TerraDrawCoordinateDeleteMode] Registered with TerraDraw');
    };

    TerraDrawCoordinateDeleteMode.prototype.start = function() {
        this._state = 'started';
        this._setCursor('pointer');
        this._createDeletePoints();
        console.log('[TerraDrawCoordinateDeleteMode] Started - created', this._deletePoints.length, 'delete points');
    };


    TerraDrawCoordinateDeleteMode.prototype.stop = function() {
        this._state = 'stopped';
        this._clearDeletePoints();
        this._setCursor('default');
        console.log('[TerraDrawCoordinateDeleteMode] Stopped');
    };

    TerraDrawCoordinateDeleteMode.prototype.cleanUp = function() {
        this._clearDeletePoints();
    };

    TerraDrawCoordinateDeleteMode.prototype._pixelDistance = function(coord1, coord2) {
        var p1 = this._project(coord1[0], coord1[1]);
        var p2 = this._project(coord2[0], coord2[1]);
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    };

    TerraDrawCoordinateDeleteMode.prototype._getCoordinatesWithIndices = function(geometry) {
        var coords = [];
        var i, j;

        if (geometry.type === 'Point') {
            coords.push({
                coord: geometry.coordinates,
                ringIndex: null,
                coordIndex: 0,
                isClosingPoint: false
            });
        } else if (geometry.type === 'LineString') {
            for (i = 0; i < geometry.coordinates.length; i++) {
                coords.push({
                    coord: geometry.coordinates[i],
                    ringIndex: null,
                    coordIndex: i,
                    isClosingPoint: false
                });
            }
        } else if (geometry.type === 'Polygon') {
            for (i = 0; i < geometry.coordinates.length; i++) {
                var ring = geometry.coordinates[i];
                for (j = 0; j < ring.length; j++) {
                    coords.push({
                        coord: ring[j],
                        ringIndex: i,
                        coordIndex: j,
                        isClosingPoint: j === ring.length - 1
                    });
                }
            }
        }

        return coords;
    };

    TerraDrawCoordinateDeleteMode.prototype._createDeletePoints = function() {
        var self = this;
        this._clearDeletePoints();

        var features = this._store.copyAll();

        features.forEach(function(feature) {
            if (feature.properties.isDeletePoint ||
                feature.properties.midPoint ||
                feature.properties.selectionPoint ||
                feature.properties.coordinatePoint) {
                return;
            }
            
            if (!feature.geometry ||
                ['Point', 'LineString', 'Polygon'].indexOf(feature.geometry.type) === -1) {
                return;
            }

            var coordsWithIndices = self._getCoordinatesWithIndices(feature.geometry);

            coordsWithIndices.forEach(function(coordInfo) {

                if (coordInfo.isClosingPoint) return;

                var ringPart = coordInfo.ringIndex !== null ? coordInfo.ringIndex : 'null';
                var deletePointId = 'delete-point-' + feature.id + '-' + ringPart + '-' + coordInfo.coordIndex;

                self._deletePoints.push({
                    id: deletePointId,
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: coordInfo.coord
                    },
                    properties: {
                        mode: self._mode,
                        isDeletePoint: true,
                        parentFeatureId: feature.id,
                        ringIndex: coordInfo.ringIndex,
                        coordIndex: coordInfo.coordIndex,
                        parentGeometryType: feature.geometry.type
                    }
                });
            });
        });
        
        if (this._deletePoints.length > 0) {
            this._store.create(this._deletePoints);
        }
    };

    TerraDrawCoordinateDeleteMode.prototype._clearDeletePoints = function() {
        var allFeatures = this._store.copyAll();
        var deletePointIds = [];

        for (var i = 0; i < allFeatures.length; i++) {
            if (allFeatures[i].properties && allFeatures[i].properties.isDeletePoint) {
                deletePointIds.push(allFeatures[i].id);
            }
        }

        if (deletePointIds.length > 0) {
            try {
                this._store.delete(deletePointIds);
            } catch (e) {
                console.error('[TerraDrawCoordinateDeleteMode] Failed to delete points:', e);
            }
        }

        this._deletePoints = [];
        this._hoveredDeletePointId = null;
    };


    TerraDrawCoordinateDeleteMode.prototype._findNearestDeletePoint = function(lng, lat) {
        var nearest = null;
        var nearestDistance = Infinity;

        for (var i = 0; i < this._deletePoints.length; i++) {
            var dp = this._deletePoints[i];
            var distance = this._pixelDistance([lng, lat], dp.geometry.coordinates);

            if (distance < this._pointerDistance && distance < nearestDistance) {
                nearest = dp;
                nearestDistance = distance;
            }
        }

        return nearest;
    };

    TerraDrawCoordinateDeleteMode.prototype._deleteCoordinate = function(deletePoint) {
        var props = deletePoint.properties;
        var parentFeatureId = props.parentFeatureId;
        var ringIndex = props.ringIndex;
        var coordIndex = props.coordIndex;
        var parentGeometryType = props.parentGeometryType;

        var features = this._store.copyAll();
        var parentFeature = null;
        for (var i = 0; i < features.length; i++) {
            if (features[i].id === parentFeatureId) {
                parentFeature = features[i];
                break;
            }
        }

        if (!parentFeature) return;

        var shouldDeleteFeature = false;
        var newGeometry = null;

        if (parentGeometryType === 'Point') {
            shouldDeleteFeature = true;
        } else if (parentGeometryType === 'LineString') {
            var coords = parentFeature.geometry.coordinates.slice();

            if (coords.length <= 2) {
                shouldDeleteFeature = true;
            } else {
                coords.splice(coordIndex, 1);
                newGeometry = {
                    type: 'LineString',
                    coordinates: coords
                };
            }
        } else if (parentGeometryType === 'Polygon') {
            var rings = parentFeature.geometry.coordinates.map(function(ring) {
                return ring.slice();
            });
            var ring = rings[ringIndex];

            if (ring.length <= 4) {
                if (rings.length === 1 || ringIndex === 0) {
                    shouldDeleteFeature = true;
                } else {
                    rings.splice(ringIndex, 1);
                    newGeometry = {
                        type: 'Polygon',
                        coordinates: rings
                    };
                }
            } else {
                ring.splice(coordIndex, 1);

                // If first point removed, update closing point
                if (coordIndex === 0) {
                    ring[ring.length - 1] = ring[0];
                }

                rings[ringIndex] = ring;
                newGeometry = {
                    type: 'Polygon',
                    coordinates: rings
                };
            }
        }

        if (shouldDeleteFeature) {
            this._store.delete([parentFeatureId]);
            if (this._onFeatureDeleted) {
                this._onFeatureDeleted(parentFeature);
            }
        } else if (newGeometry) {
            this._store.updateGeometry([{
                id: parentFeatureId,
                geometry: newGeometry
            }]);

            if (this._onCoordinateDeleted) {
                this._onCoordinateDeleted({
                    featureId: parentFeatureId,
                    ringIndex: ringIndex,
                    coordIndex: coordIndex,
                    deletedCoordinate: deletePoint.geometry.coordinates
                });
            }
        }


        this._createDeletePoints();

        if (this._onChange) {
            this._onChange([], 'delete');
        }
    };

    TerraDrawCoordinateDeleteMode.prototype.onClick = function(event) {
        var nearest = this._findNearestDeletePoint(event.lng, event.lat);
        if (nearest) {
            this._deleteCoordinate(nearest);
        }
    };


    TerraDrawCoordinateDeleteMode.prototype.onMouseMove = function(event) {
        var nearest = this._findNearestDeletePoint(event.lng, event.lat);

        if (nearest) {
            if (this._hoveredDeletePointId !== nearest.id) {
                this._hoveredDeletePointId = nearest.id;
                this._hoveredFeatureId = nearest.properties.parentFeatureId;
                this._setCursor('pointer');

                if (this._onChange) {
                    this._onChange([], 'styling');
                }
            }
        } else if (this._hoveredDeletePointId !== null) {
            this._hoveredDeletePointId = null;
            this._hoveredFeatureId = null;
            this._setCursor('crosshair');

            if (this._onChange) {
                this._onChange([], 'styling');
            }
        }
    };

    // Required empty handlers
    TerraDrawCoordinateDeleteMode.prototype.onKeyDown = function(event) {};
    TerraDrawCoordinateDeleteMode.prototype.onKeyUp = function(event) {};
    TerraDrawCoordinateDeleteMode.prototype.onDragStart = function(event) {};
    TerraDrawCoordinateDeleteMode.prototype.onDrag = function(event) {};
    TerraDrawCoordinateDeleteMode.prototype.onDragEnd = function(event) {};

    // Style features
    TerraDrawCoordinateDeleteMode.prototype.styleFeature = function(feature) {
        var styles = this._styles;
        var isDeletePoint = feature.properties && feature.properties.isDeletePoint;
        var isHoveredDeletePoint = feature.id === this._hoveredDeletePointId;
        var isHoveredFeature = feature.id === this._hoveredFeatureId;

        // Style delete point markers
        if (isDeletePoint) {
            return {
                pointColor: isHoveredDeletePoint ? styles.highlightColor : styles.deletePointColor,
                pointOutlineColor: styles.deletePointOutlineColor,
                pointWidth: isHoveredDeletePoint ? styles.deletePointWidth + 4 : styles.deletePointWidth,
                pointOutlineWidth: styles.deletePointOutlineWidth,
                zIndex: 1000
            };
        }

        var geomType = feature.geometry ? feature.geometry.type : null;

        if (geomType === 'Point') {
            return {
                pointColor: isHoveredFeature ? styles.highlightColor : styles.pointColor,
                pointOutlineColor: styles.pointOutlineColor,
                pointWidth: styles.pointWidth,
                pointOutlineWidth: styles.pointOutlineWidth,
                zIndex: 10
            };
        }

        if (geomType === 'LineString') {
            return {
                lineStringColor: isHoveredFeature ? styles.highlightColor : styles.lineStringColor,
                lineStringWidth: styles.lineStringWidth,
                zIndex: 10
            };
        }

        if (geomType === 'Polygon') {
            return {
                polygonFillColor: isHoveredFeature ? styles.highlightColor : styles.featureFillColor,
                polygonFillOpacity: isHoveredFeature ? 0.4 : styles.featureFillOpacity,
                polygonOutlineColor: styles.featureOutlineColor,
                polygonOutlineWidth: styles.featureOutlineWidth,
                zIndex: 5
            };
        }

        return {
            pointColor: styles.pointColor,
            lineStringColor: styles.lineStringColor,
            polygonFillColor: styles.featureFillColor,
            polygonFillOpacity: styles.featureFillOpacity,
            polygonOutlineColor: styles.featureOutlineColor,
            polygonOutlineWidth: styles.featureOutlineWidth
        };
    };

    // Validate feature
    TerraDrawCoordinateDeleteMode.prototype.validateFeature = function(feature) {
        return feature.geometry &&
            ['Point', 'LineString', 'Polygon'].indexOf(feature.geometry.type) !== -1;
    };

    return TerraDrawCoordinateDeleteMode;
})();


/*
 * NASA Worldview
 *
 * This code was originally developed at NASA/Goddard Space Flight Center for
 * the Earth Science Data and Information System (ESDIS) project.
 *
 * Copyright (C) 2013 - 2014 United States Government as represented by the
 * Administrator of the National Aeronautics and Space Administration.
 * All Rights Reserved.
 */

var wv = wv || {};
wv.map = wv.map || {};

wv.map.ui = wv.map.ui || function(models, config) {

    var id = "wv-map";
    var selector = "#" + id;
    var cache = new Cache(100); // Save layers from days visited

    var self = {};
    self.proj = {}; // One map for each projection
    self.selected = null; // The map for the selected projection
    self.events = wv.util.events();

    var init = function() {
        if ( config.parameters.mockMap ) {
            return;
        }
        // NOTE: iOS sometimes bombs if this is _.each instead. In that case,
        // it is possible that config.projections somehow becomes array-like.
        _.forOwn(config.projections, function(proj) {
            var map = createMap(proj);
            self.proj[proj.id] = map;
        });

        models.proj.events.on("select", function() {
            updateProjection();
        });
        models.layers.events
            .on("add", addLayer)
            .on("remove", removeLayer)
            .on("visibility", updateLayerVisibilities)
            .on("opacity", updateOpacity)
            .on("update", updateLayerOrder);
        models.date.events.on("select", updateDate);
        models.palettes.events
            .on("set-custom", updateLookup)
            .on("clear-custom", updateLookup)
            .on("range", updateLookup)
            .on("update", updateLookup);
        $(window).on("resize", onResize);
        updateProjection(true);
    };

    var updateProjection = function(start) {
        if ( self.selected ) {
            // Keep track of center point on projection switch
            self.selected.previousCenter = self.selected.center;
            hideMap(self.selected);
        }
        self.selected = self.proj[models.proj.selected.id];
        var map = self.selected;
        reloadLayers();

        // If the browser was resized, the inactive map was not notified of
        // the event. Force the update no matter what and reposition the center
        // using the previous value.
        showMap(map);
        map.updateSize();

        if ( self.selected.previousCenter ) {
            self.selected.setCenter(self.selected.previousCenter);
        }

        // This is awkward and needs a refactoring
        if ( start ) {
            var projId = models.proj.selected.id;
            var extent = null;
            if ( models.map.extent ) {
                extent = models.map.extent;
            } else if ( !models.map.extent && projId === "geographic" ) {
                extent = models.map.getLeadingExtent();
            }
            if ( extent ) {
                map.getView().fitExtent(extent, map.getSize());
            }
        }
        updateExtent();
        onResize();
    };

    var onResize = function() {
        var map = self.selected;
        if ( map.small !== wv.util.browser.small ) {
            if ( wv.util.browser.small ) {
                map.removeControl(map.wv.scaleImperial);
                map.removeControl(map.wv.scaleMetric);
                map.removeControl(map.wv.mousePosition);
            } else {
                map.addControl(map.wv.scaleImperial);
                map.addControl(map.wv.scaleMetric);
                map.addControl(map.wv.mousePosition);
            }
        }
    };

    var hideMap = function(map) {
        $("#" + map.getTarget()).hide();
    };

    var showMap = function(map) {
        $("#" + map.getTarget()).show();
    };

    var clearLayers = function(map) {
        var activeLayers = map.getLayers().getArray().slice(0);
        _.each(activeLayers, function(mapLayer) {
            if ( mapLayer.wv ) {
                map.removeLayer(mapLayer);
            }
        });
        removeGraticule();
        //cache.clear();
    };

    var reloadLayers = function(map) {
        map = map || self.selected;
        var proj = models.proj.selected;
        clearLayers(map);

        var defs = models.layers.get({reverse: true});
        _.each(defs, function(def) {
            if ( isGraticule(def) ) {
                addGraticule();
            } else {
                self.selected.addLayer(createLayer(def));
            }
        });
        updateLayerVisibilities();
    };

    var updateLayerVisibilities = function() {
        self.selected.getLayers().forEach(function(layer) {
            if ( layer.wv ) {
                var renderable = models.layers.isRenderable(layer.wv.id);
                layer.setVisible(renderable);
            }
        });
    };

    var updateOpacity = function(def, value) {
        var layer = findLayer(def);
        layer.setOpacity(value);
        updateLayerVisibilities();
    };

    var addLayer = function(def) {
        var mapIndex = _.findIndex(models.layers.get({reverse: true}), {
            id: def.id
        });
        if ( isGraticule(def) ) {
            addGraticule();
        } else {
            var layer = createLayer(def);
            self.selected.getLayers().insertAt(mapIndex, layer);
        }
        updateLayerVisibilities();
    };

    var removeLayer = function(def) {
        if ( isGraticule(def) ) {
            removeGraticule();
        } else {
            var layer = findLayer(def);
            self.selected.removeLayer(layer);
        }
    };

    var updateLayerOrder = function() {
        reloadLayers();
    };

    var updateDate = function() {
        var defs = models.layers.get();
        _.each(defs, function(def) {
            if ( def.period !== "daily" ) {
                return;
            }
            var index = findLayerIndex(def);
            self.selected.getLayers().setAt(index, createLayer(def));
        });
        updateLayerVisibilities();
    };

    var updateLookup = function(layerId) {
        // If the lookup changes, all layers in the cache are now stale
        // since the tiles need to be rerendered. Remove from cache.
        var selectedDate = wv.util.toISOStringDate(models.date.selected);
        var selectedProj = models.proj.selected.id;
        cache.removeWhere(function(key, mapLayer) {
            if ( mapLayer.wvid === layerId &&
                 mapLayer.wvproj === selectedProj &&
                 mapLayer.wvdate !== selectedDate &&
                 mapLayer.lookupTable ) {
                return true;
            }
            return false;
        });
        reloadLayers();
    };

    self.preload = function(date) {
        var layers = models.layers.get({
            renderable: true,
            dynamic: true
        });
        _.each(layers, function(def) {
            var key = layerKey(def, {date: date});
            var layer = cache.getItem(key);
            if ( !layer ) {
                layer = createLayer(def, {date: date});
            }
        });
    };

    var findLayer = function(def) {
        var layers = self.selected.getLayers().getArray();
        var layer = _.find(layers, { wv: { id: def.id } });
        return layer;
    };

    var findLayerIndex = function(def) {
        var layers = self.selected.getLayers().getArray();
        var layer = _.findIndex(layers, { wv: { id: def.id } });
        return layer;
    };

    var createLayer = function(def, options) {
        options = options || {};
        var key = layerKey(def, options);
        var layer = cache.getItem(key);
        if ( !layer ) {
            var proj = models.proj.selected;
            def = _.cloneDeep(def);
            _.merge(def, def.projections[proj.id]);
            if ( def.type === "wmts" ) {
                layer = createLayerWMTS(def, options);
            } else if ( def.type === "wms" ) {
                layer = createLayerWMS(def, options);
            } else {
                throw new Error("Unknown layer type: " + def.type);
            }
            var date = options.date || models.date.selected;
            layer.wv = {
                id: def.id,
                key: key,
                date: wv.util.toISOStringDate(date),
                proj: proj.id,
                def: def
            };
            cache.setItem(key, layer);
            layer.setVisible(false);
        }
        layer.setOpacity(def.opacity || 1.0);
        return layer;
    };

    var createLayerWMTS = function(def, options) {
        var proj = models.proj.selected;
        var source = config.sources[def.source];
        if ( !source ) {
            throw new Error(def.id + ": Invalid source: " + def.source);
        }
        var matrixSet = source.matrixSets[def.matrixSet];
        if ( !matrixSet ) {
            throw new Error(def.id + ": Undefined matrix set: " + def.matrixSet);
        }
        var matrixIds = [];
        _.each(matrixSet.resolutions, function(resolution, index) {
            matrixIds.push(index);
        });
        var extra = "";
        if ( def.period === "daily" ) {
            var date = options.date || models.date.selected;
            extra = "?TIME=" + wv.util.toISOStringDate(date);
        }
        var sourceOptions = {
            url: source.url + extra,
            layer: def.layer || def.id,
            format: def.format,
            matrixSet: matrixSet.id,
            tileGrid: new ol.tilegrid.WMTS({
                origin: [proj.maxExtent[0], proj.maxExtent[3]],
                resolutions: matrixSet.resolutions,
                matrixIds: matrixIds,
                tileSize: matrixSet.tileSize[0]
            }),
            wrapX: false
        };
        if ( models.palettes.isActive(def.id) ) {
            var lookup = models.palettes.get(def.id).lookup;
            sourceOptions.tileClass = ol.wv.LookupImageTile.factory(lookup);
        }
        var layer = new ol.layer.Tile({
            source: new ol.source.WMTS(sourceOptions)
        });
        return layer;
    };

    var createLayerWMS = function(def, options) {
        var proj = models.proj.selected;
        var source = config.sources[def.source];
        if ( !source ) {
            throw new Error(def.id + ": Invalid source: " + def.source);
        }

        var transparent = ( def.format === "image/png" );
        var parameters = {
            LAYERS: def.layer || def.id,
            FORMAT: def.format,
            TRANSPARENT: transparent,
            VERSION: "1.1.1"
        };
        var extra = "";
        if ( def.period === "daily" ) {
            var date = options.date || models.date.selected;
            extra = "?TIME=" + wv.util.toISOStringDate(date);
        }
        var layer = new ol.layer.Tile({
            source: new ol.source.TileWMS({
                url: source.url + extra,
                params: parameters,
                tileGrid: new ol.tilegrid.TileGrid({
                    origin: [proj.maxExtent[0], proj.maxExtent[3]],
                    resolutions: proj.resolutions,
                    tileSize: 512
                })
            })
        });
        return layer;
    };

    var isGraticule = function(def) {
        var proj = models.proj.selected.id;
        return ( def.projections[proj].type === "graticule" ||
            def.type === "graticule" );
    };

    var addGraticule = function() {
        var graticule = new ol.Graticule({
            map: self.selected,
            strokeStyle: new ol.style.Stroke({
                color: 'rgba(255, 255, 255, 0.5)',
                width: 2,
                lineDash: [0.5, 4]
            })
        });
        self.selected.graticule = graticule;
    };

    var removeGraticule = function() {
        if ( self.selected.graticule ) {
            self.selected.graticule.setMap(null);
        }
    };

    var triggerExtent = _.throttle(function() {
        self.events.trigger("extent");
    }, 500, { trailing: true });

    var updateExtent = function() {
        var map = self.selected;
        models.map.update(map.getView().calculateExtent(map.getSize()));
        triggerExtent();
    };

    var createMap = function(proj) {
        var id = "wv-map-" + proj.id;
        var $map = $("<div></div>")
            .attr("id", id)
            .attr("data-proj", proj.id)
            .addClass("wv-map")
            .hide();
        $(selector).append($map);

        var scaleMetric = new ol.control.ScaleLine({
            className: "wv-map-scale-metric",
            units: "metric"
        });
        var scaleImperial = new ol.control.ScaleLine({
            className: "wv-map-scale-imperial",
            units: "imperial"
        });
        var coordinateFormat = function(source) {
            var target = ol.proj.transform(source, proj.crs, "EPSG:4326");
            var crs = ( models.proj.change ) ? models.proj.change.crs
                    : models.proj.selected.crs;
            var str = wv.util.formatDMS(target[1], "latitude") + ", " +
                      wv.util.formatDMS(target[0], "longitude") + " " +
                      crs;
            return str;
        };
        var mousePosition = new ol.control.MousePosition({
            coordinateFormat: coordinateFormat
        });

        var map = new ol.Map({
            view: new ol.View({
                maxResolution: proj.resolutions[0],
                projection: ol.proj.get(proj.crs),
                extent: proj.maxExtent,
                center: proj.startCenter,
                zoom: proj.startZoom,
                maxZoom: proj.numZoomLevels,
                enableRotation: false
            }),
            target: id,
            renderer: ["canvas", "dom"],
            logo: false,
            controls: [
                scaleMetric,
                scaleImperial,
                mousePosition
            ],
            interactions: [
                new ol.interaction.DoubleClickZoom(),
                new ol.interaction.DragPan({
                    kinetic: new ol.Kinetic(-0.005, 0.05, 100)
                }),
                new ol.interaction.PinchZoom(),
                new ol.interaction.MouseWheelZoom(),
                new ol.interaction.DragZoom()
            ]
        });
        map.wv = {
            small: false,
            scaleMetric: scaleMetric,
            scaleImperial: scaleImperial,
            mousePosition: mousePosition
        };
        createZoomButtons(map, proj);

        map.getView().on("change:center", updateExtent);
        map.getView().on("change:resolution", updateExtent);

        return map;
    };

    var createZoomButtons = function(map, proj) {
        var $map = $("#" + map.getTarget());

        var $zoomOut = $("<button></button>")
            .addClass("wv-map-zoom-out")
            .addClass("wv-map-zoom");
        var $outIcon = $("<i></i>")
            .addClass("fa")
            .addClass("fa-minus")
            .addClass("fa-1x");
        $zoomOut.append($outIcon);
        $map.append($zoomOut);
        $zoomOut.button({
            text: false
        });
        $zoomOut.click(zoomAction(map, -1));

        var $zoomIn = $("<button></button>")
            .addClass("wv-map-zoom-in")
            .addClass("wv-map-zoom");
        var $inIcon = $("<i></i>")
            .addClass("fa")
            .addClass("fa-plus")
            .addClass("fa-1x");
        $zoomIn.append($inIcon);
        $map.append($zoomIn);
        $zoomIn.button({
            text: false
        });
        $zoomIn.click(zoomAction(map, 1));

        var onZoomChange = function() {
            var maxZoom = proj.resolutions.length;
            var zoom = map.getView().getZoom();
            if ( zoom === 0 ) {
                $zoomIn.button("enable");
                $zoomOut.button("disable");
            } else if ( zoom === maxZoom ) {
                $zoomIn.button("disable");
                $zoomOut.button("enable");
            } else {
                $zoomIn.button("enable");
                $zoomOut.button("enable");
            }
        };

        map.getView().on("change:resolution", onZoomChange);
        onZoomChange();
    };

    var zoomAction = function(map, amount) {
        return function() {
            var zoom = map.getView().getZoom();
            map.beforeRender(ol.animation.zoom({
                resolution: map.getView().getResolution(),
                duration: 250
            }));
            map.getView().setZoom(zoom + amount);
        };
    };

    var layerKey = function(def, options) {
        var layerId = def.id;
        var projId = models.proj.selected.id;
        var date;
        if ( options.date ) {
            date = wv.util.toISOStringDate(options.date);
        } else {
            date = wv.util.toISOStringDate(models.date.selected);
        }
        var dateId = ( def.period === "daily" ) ? date : "";
        var palette = "";
        if ( models.palettes.isActive(def.id) ) {
            palette = models.palettes.key(def.id);
        }
        return [layerId, projId, dateId, palette].join(":");
    };

    init();
    return self;

};

wv.map.ui.lookupTileClassFactory = function(models, def) {

    return function(tileCoord, tileState, src, crossOrigin, tileLoadFunction) {
        var image = new Image();
        var canvas = document.createElement("canvas");

        var self = new ol.ImageTile(tileCoord, tileState, null, "anonymous",
                tileLoadFunction);

        self.getImage = function(opt_context) {
            return canvas;
        };

        self.getKey = function() {
            return image.src;
        };

        self.load = function() {
            if ( self.state == ol.TileState.IDLE ) {
                var lookup = models.palettes.get(def.id).lookup;
                self.state = ol.TileState.LOADING;
                image.addEventListener("load", function() {
                    console.log("load called");
                    w = image.width;
                    h = image.height;
                    canvas.width = w;
                    canvas.height = h;
                    var g = canvas.getContext("2d");
                    g.drawImage(image, 0, 0);
                    var imageData = g.getImageData(0, 0, canvas.width,
                        canvas.height);
                    var pixelData = imageData.data;
                    for ( var i = 0; i < w * h * 4; i += 4 ) {
                        var source = pixelData[i + 0] + "," +
                                     pixelData[i + 1] + "," +
                                     pixelData[i + 2] + "," +
                                     pixelData[i + 3];
                        var target = lookup[source];
                        if ( target ) {
                            pixelData[i + 0] = target.r;
                            pixelData[i + 1] = target.g;
                            pixelData[i + 2] = target.b;
                            pixelData[i + 3] = target.a;
                        }
                    }
                    g.putImageData(imageData, 0, 0);
                    self.state = ol.TileState.LOADED;
                    console.log("self.chagned", self.changed);
                    self.changed.apply(self);
                    self.dispatchEvent("change");
                });
                image.crossOrigin = "anonymous";
                image.src = src;
            }
        };

        return self;
    };
};

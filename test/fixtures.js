// FIXME: OL3
proj4.defs("EPSG:3413", "+title=WGS 84 / NSIDC Sea Ice Polar Stereographic North +proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs");
proj4.defs("EPSG:3031", "+title=WGS 84 / Antarctic Polar Stereographic +proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs");


var fixtures = {
    red: "ff0000ff",
    light_red: "fff0f0ff",
    dark_red: "400000ff",
    green: "00ff00ff",
    yellow: "ffff00ff",
    blue: "0000ffff",
    light_blue: "f0f0ffff",
    dark_blue: "000040"
};

fixtures.config = function() { return {
    defaults: {
        projection: "geographic"
    },
    projections: {
        geographic: {
            id: "geographic",
            epsg: 4326,
            crs: "EPSG:4326",
            maxExtent: [-180, -90, 180, 90]
        },
        arctic: {
            id: "arctic",
            epsg: 3413,
            crs: "EPSG:3413"
        },
        antarctic: {
            id: "antarctic",
            epsg: 3031,
            crs: "EPSG:3031"
        }
    },
    layers: {
        "terra-cr": {
            id: "terra-cr",
            group: "baselayers",
            period: "daily",
            startDate: "2000-01-01",
            projections: { geographic: {}, arctic: {}, antarctic: {} }
        },
        "aqua-cr": {
            id: "aqua-cr",
            group: "baselayers",
            period: "daily",
            startDate: "2002-01-01",
            projections: { geographic: {}, arctic: {}, antarctic: {} }
        },
        "mask": {
            id: "mask",
            group: "baselayers",
            projections: { geographic: {}, arctic: {}, antarctic: {} }
        },
        "terra-aod": {
            id: "terra-aod",
            group: "overlays",
            period: "daily",
            startDate: "2000-01-01",
            projections: { geographic: {} },
            palette: { id: "terra-aod" }
        },
        "aqua-aod": {
            id: "aqua-aod",
            group: "overlays",
            period: "daily",
            startDate: "2002-01-01",
            projections: { geographic: {} },
            palette: { id: "aqua-aod" }
        },
        "combo-aod": {
            id: "combo-aod",
            group: "overlays",
            projections: { geographic: {} },
        }
    },
    palettes: {
        rendered: {
            "terra-aod": {
                scale: {
                    colors: [fixtures.green, fixtures.yellow, fixtures.red],
                    labels: ["0", "1", "2"],
                    values: [0, 1, 2]
                }
            },
            "aqua-aod": {
                scale: {
                    colors: [fixtures.green, fixtures.yellow, fixtures.red],
                    labels: ["0", "1", "2"],
                    values: [0, 1, 2]
                }
            }
        },
        custom: {
            "blue-1": {
                colors: [fixtures.light_blue, fixtures.blue, fixtures.dark_blue]
            },
            "red-1": {
                colors: [fixtures.light_red, fixtures.red, fixtures.dark_red]
            }
        }
    }
};};

fixtures.models = function(config) {
    var models = {};

    models.date = wv.date.model(config);
    models.proj = wv.proj.model(config);
    models.layers = wv.layers.model(models, config);
    models.palettes = wv.palettes.model(models, config);
    models.map = wv.map.model(models, config);

    return models;
};

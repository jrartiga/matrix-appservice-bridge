"use strict";
var Datastore = require("nedb");
var fs = require("fs");
var log = require("../log");
var Promise = require("bluebird");

var RoomBridgeStore = require("../..").RoomBridgeStore;
var MatrixRoom = require("../..").MatrixRoom;
var RemoteRoom = require("../..").RemoteRoom;
var TEST_DB_PATH = __dirname + "/test.db";

describe("RoomBridgeStore", function() {
    var store, db;

    beforeEach(
    /** @this */
    function(done) {
        log.beforeEach(this);
        db = new Datastore({
            filename: TEST_DB_PATH,
            autoload: true,
            onload: function(err) {
                if (err) {
                    console.error(err);
                    return;
                }
                store = new RoomBridgeStore(db);
                done();
            }
        });
    });

    afterEach(function() {
        try {
            fs.unlinkSync(TEST_DB_PATH);
        }
        catch (e) {
            // do nothing
        }
    });

    describe("upsertEntry", function() {
        it("should insert an entry and should be retrievable by getEntryById",
        function(done) {
            var entry = {
                id: "flibble",
                matrix: new MatrixRoom("!foo:bar"),
                remote: new RemoteRoom("#flibble"),
            };
            store.upsertEntry(entry).then(function() {
                return store.getEntryById("flibble");
            }).done(function(e) {
                expect(e.id).toEqual(entry.id);
                expect(e.matrix.getId()).toEqual("!foo:bar");
                expect(e.remote.getId()).toEqual("#flibble");
                done();
            });
        });

        it("should update an entry if one with the same 'id' exists", function(done) {
            var entry = {
                id: "flibble",
                matrix: new MatrixRoom("!foo:bar"),
                remote: new RemoteRoom("#flibble"),
            };
            store.upsertEntry(entry).then(function() {
                var entry2 = {
                    id: "flibble",
                    matrix: new MatrixRoom("!woo:bar"),
                    remote: new RemoteRoom("#wibble"),
                };
                return store.upsertEntry(entry2);
            }).then(function() {
                return store.getEntryById("flibble");
            }).done(function(e) {
                expect(e.id).toEqual("flibble");
                expect(e.matrix.getId()).toEqual("!woo:bar");
                expect(e.remote.getId()).toEqual("#wibble");
                done();
            });
        });
    });

    describe("getEntryById", function() {

        it("should return nothing for matching matrix_id or remote_id", function(done) {
            var entry = {
                id: "flibble",
                matrix: new MatrixRoom("!nothing:here"),
                remote: new RemoteRoom("!nothing:here"),
            };
            store.upsertEntry(entry).then(function() {
                return store.getEntryById("!nothing:here");
            }).done(function(e) {
                expect(e).toBeNull();
                done();
            });
        });
    });

    describe("getEntriesByMatrixId", function() {
        it("should return for matching matrix_ids", function(done) {
            var entry = {
                id: "id1", matrix: new MatrixRoom("!foo:bar"),
                remote: new RemoteRoom("#foo")
            };
            var entry2 = {
                id: "id2", matrix: new MatrixRoom("!foo:bar"),
                remote: new RemoteRoom("#bar")
            };
            Promise.all(
                [store.upsertEntry(entry), store.upsertEntry(entry2)]
            ).then(function() {
                return store.getEntriesByMatrixId("!foo:bar");
            }).done(function(results) {
                expect(results.length).toEqual(2);
                var remoteIds = results.map(function(res) {
                    return res.remote.getId();
                });
                expect(remoteIds.sort()).toEqual(["#bar", "#foo"]);
                done();
            });
        });
    });

    describe("getEntriesByMatrixIds", function() {
        it("should return a map of room_id to entry", function(done) {
            var entries = [
                {
                    id: "id1",
                    matrix: new MatrixRoom("!foo:bar"),
                    remote: new RemoteRoom("#foo")
                },
                {
                    id: "id2",
                    matrix: new MatrixRoom("!foo:bar"),
                    remote: new RemoteRoom("#bar")
                },
                {
                    id: "id3",
                    matrix: new MatrixRoom("!fizz:buzz"),
                    remote: new RemoteRoom("#fizz")
                },
                {
                    id: "id4",
                    matrix: new MatrixRoom("!zzz:zzz"),
                    remote: new RemoteRoom("#buzz")
                }
            ];
            Promise.all(
                entries.map(function(e) { return store.upsertEntry(e); })
            ).then(function() {
                return store.getEntriesByMatrixIds(["!foo:bar", "!fizz:buzz"]);
            }).done(function(results) {
                expect(results["!foo:bar"].length).toEqual(2);
                expect(results["!fizz:buzz"].length).toEqual(1);
                expect(results["!fizz:buzz"][0].remote.getId()).toEqual("#fizz");
                expect(results["!foo:bar"].map(function(e) {
                    return e.remote.getId();
                }).sort()).toEqual(["#bar", "#foo"]);

                done();
            })
        });
    });

    describe("getEntriesByRemoteId", function() {
        it("should return for matching remote_ids", function(done) {
            var entry = {
                id: "id1", matrix: new MatrixRoom("!foo:bar"),
                remote: new RemoteRoom("#foo")
            };
            var entry2 = {
                id: "id2", matrix: new MatrixRoom("!foo:bar"),
                remote: new RemoteRoom("#bar")
            };
            Promise.all(
                [store.upsertEntry(entry), store.upsertEntry(entry2)]
            ).then(function() {
                return store.getEntriesByRemoteId("#foo");
            }).done(function(results) {
                expect(results.length).toEqual(1);
                expect(results[0].matrix.getId()).toEqual("!foo:bar");
                done();
            });
        });
    });

    describe("linkRooms", function() {
        it("should create a single entry", function(done) {
            var m = new MatrixRoom("!foo:bar");
            m.set("mxkey", "mxval");
            var r = new RemoteRoom("#foo");
            r.set("remotekey", { "nested": "remote_val"});
            store.linkRooms(m, r,
                { some: "data_goes_here" },
                "_custom_id"
            ).then(function() {
                return store.getEntryById("_custom_id");
            }).done(function(entry) {
                expect(entry.id).toEqual("_custom_id");
                expect(entry.remote.getId()).toEqual("#foo");
                expect(entry.remote.get("remotekey")).toEqual({nested: "remote_val"});
                expect(entry.matrix.getId()).toEqual("!foo:bar");
                expect(entry.matrix.get("mxkey")).toEqual("mxval");
                expect(entry.data).toEqual({some: "data_goes_here"});
                done();
            });
        });
    });
});

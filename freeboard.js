/**
 * Copyright 2015 Urbiworx
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var _           = require("underscore");
var express     = require("express");
var mustache    = require("mustache");
var bodyParser  = require('body-parser');
var fs          = require("fs");
var path        = require("path");

module.exports = function(RED) {
  "use strict";

  var log_i = function() {
    //console.log.apply(console, arguments);
  };

  var userDir="";
  if (RED.settings.userDir){
    userDir=RED.settings.userDir+"/";
  }

  var pendingresponses = [];

  var dstemplate = fs.readFileSync(path.join(__dirname, "datasource.template"), 'utf8');
  var dslib      = fs.readFileSync(path.join(__dirname, "datasource.jsheader"), 'utf8');

  var load_js = fs.readFileSync(path.join(__dirname, "load.js"), 'utf8');
  var save_js = fs.readFileSync(path.join(__dirname, "save.js"), 'utf8');

  var myFreeboardInstallDir = path.join(__dirname, '/../..', '/node_modules/freeboard');
  var freeboardStats = fs.statSync(myFreeboardInstallDir);
  if (!freeboardStats.isDirectory()) {
    myFreeboardInstallDir = path.join(__dirname, '/node_modules/freeboard');
  }
  log_i("node-red-contrib-freeboard(bcs) -- Loading freeboard from %s", myFreeboardInstallDir);

  var nodes = [];
  function Freeboard(n) {
    RED.nodes.createNode(this, n);

    var self    = this;
    this.name   = n.name.trim();
    nodes.push(this);

    this.on("input", function(msg) {
      self.lastValue = msg.payload;
      postValue(self.id, self.lastValue);
    });

    this.on("close",function() {
      var index = nodes.indexOf(self);
      if (index > -1) {
        nodes.splice(index, 1);
      }
    });
  }

  function postValue(id, value){
    var resp = pendingresponses;
    pendingresponses = [];

    for (var i in resp){
      var ret={};
      ret[id]=value;
      resp[i].end(JSON.stringify(ret));
    }
  }

  function interval(){
    var resp = pendingresponses;
    pendingresponses = [];

    for (var i in resp){
      resp[i].end(JSON.stringify({}));
    }
  }
  setInterval(interval,60000);


  RED.httpNode.use(bodyParser.urlencoded({
    extended: true
  }));

  var staticFiles = express.static(myFreeboardInstallDir);

  var logRequest = function(req, res) {
    //log_i("----------- Request: %s", req.originalUrl, req.query);
  };

  RED.httpNode.use("/freeboard", function(req, res, next) {

    logRequest(req, res);

    var m, filePartialPath;
    if ((m = /\/freeboard\/(.*freeboard\.datasources\.js)$/.exec(req.originalUrl))) {
      filePartialPath = m[1];

      return fs.readFile(path.join(myFreeboardInstallDir, filePartialPath), 'utf8', function(err, contents) {
        if (err) { console.error(err); return next(err); }

        // Write the script that was actually requested
        res.write(contents);

        // Then write our "datasources" objects
        res.write(dslib);
        for (var i in nodes){
          res.write(mustache.render(dstemplate, {name:nodes[i].name, display_name:nodes[i].name,description:'',id:nodes[i].id}));
          log_i("node-red-contrib-freeboard(bcs) -- injecting data source %s", nodes[i].name);
        }

        // Then write the special loader function
        res.write(load_js);

        res.end();

      });

    } else if ((m = /\/freeboard\/(.*FreeboardModel\.js)$/.exec(req.originalUrl))) {
      filePartialPath = m[1];

      return fs.readFile(path.join(myFreeboardInstallDir, filePartialPath), 'utf8', function(err, contents) {
        if (err) { console.error(err); return next(err); }

        // Write the script that was actually requested

        // When we are serving FreeboardModel, put our own save function inside the class
        var beforeLines = contents.split('\n');
        var afterLines = [];
        var currentLine;
        do {
          currentLine = beforeLines.pop();
          afterLines.unshift(currentLine);
        } while (!/^\s*};?\s*$/.exec(currentLine));

        if (beforeLines.length !== 0 && afterLines.length !== 0) {
          res.write(beforeLines.join('\n'));
          res.write(save_js);
          res.write(afterLines.join('\n'));
        } else {
          res.write(contents);
        }

        res.end();
      });
    } else if (/^\/freeboard\/?$/.exec(req.originalUrl)) {

      return fs.readFile(path.join(myFreeboardInstallDir, 'index-dev.html'), 'utf8', function(err, contents) {
        if (err) { console.error(err); return next(err); }

        // Write the script that was actually requested

        // The index-dev.html file has calls to freeboard.initialize, so do not allow them.
        contents = _.chain(contents.split('\n')).filter(function(line) {
          if (/^\s*freeboard.(setAssetRoot|initialize)\(/.exec(line)) {
            return false;
          }
          return true;
        }).value().join('\n');

        res.write(contents);

        res.end();
      });
    }

    staticFiles.apply(express, arguments);
  });

  RED.httpNode.get("/freeboard_api/datasources", function (req,res){
    logRequest(req, res);
    res.write(dslib);
    for (var i in nodes){
      res.write(mustache.render(dstemplate,{name:nodes[i].name,display_name:nodes[i].name,description:'',id:nodes[i].id}));
    }
    res.end();
  });

  RED.httpNode.post("/freeboard_api/dashboard", function (req,res){
    logRequest(req, res);
    var filename = userDir+"freeboard_"+req.body.name+".json";
    fs.writeFile(filename, req.body.content, function (err, data) {
      if (err) throw err;
      res.end();
      log_i("node-red-contrib-freeboard(bcs) -- saving to %s", filename);
    });

  });

  RED.httpNode.get("/freeboard_api/datasourceupdate", function (req,res){
    logRequest(req, res);
    if (req.query.direct) {
      var ret={};
      for (var i in nodes){
        ret[nodes[i].id]=nodes[i].lastValue;
      }
      res.end(JSON.stringify(ret));
    } else {
      pendingresponses.push(res);
    }
  });

  RED.httpNode.get("/freeboard_api/dashboard/:name", function (req,res){
    logRequest(req, res);
    var filename = userDir+"freeboard_"+req.params.name+".json";
    fs.readFile(filename, function (err, data) {
      if (err) {
        res.end(JSON.stringify({empty:true}));
      } else {
        res.end(data.toString());
        log_i("node-red-contrib-freeboard(bcs) -- loading from %s", filename);
      }
    });

  });


  RED.nodes.registerType("freeboard",Freeboard);
};


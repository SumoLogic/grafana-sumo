define([
  'lodash'
],
function (_) {
  'use strict';

  function MetricFindQuery(datasource, query, timeSrv) {
    this.datasource = datasource;
    this.query = query;
    this.range = timeSrv.timeRange();

    // console.log(">>>> MetricsFindQuery() start");
    // console.log(datasource);
    // console.log(query);
    // console.log(timeSrv);
  }

  MetricFindQuery.prototype.process = function() {
    // console.log(">>>> MetricsFindQuery.process()");

    var split = this.query.split("|");
    var type = split[0];
    var parameter = split[1];
    var actualQuery = split[2];
    // console.log(">>>> MetricsFindQuery.process() type " + type +
    //   " parameter " + parameter + " actual query " + actualQuery);

    var url = "";
    var data = {};
    if (type === "metaTags") {
      url = '/api/v1/metrics/meta/catalog/query';
      data = '{"query":"' + actualQuery + '", "offset":0, "limit":100000}';
      return this.datasource._request('POST', url, data)
        .then(function(result) {
          // console.log(">>>> MetricsFindQuery.process() - Meta tags result");
          // console.log(result);
          var resultToReturn = _.map(result.data.results, function(resultEntry) {
            // console.log(">>> Meta tags result entry ");
            // console.log(resultEntry);
            var metaTags = resultEntry.metaTags;
            // console.log(">>> Meta tags");
            // console.log(metaTags);
            var metaTagCount = metaTags.length;
            var metaTag = null;
            for (var metaTagIndex = 0; metaTagIndex < metaTagCount; metaTagIndex++) {
              metaTag = metaTags[metaTagIndex];
              if (metaTag.key === parameter) {
                break;
              }
            }
            // console.log(">>> Meta tag");
            // console.log(metaTag);
            return {
              text: metaTag.value,
              expandable: true
            };
          });
          // console.log(">>>> MetricsFindQuery.process() - Meta tags result");
          // console.log(resultToReturn);
          return resultToReturn;
        });
    } else if (type === "metrics") {
      url = '/api/v1/metrics/meta/catalog/query';
      data = '{"query":"' + actualQuery + '", "offset":0, "limit":100000}';
      return this.datasource._request('POST', url, data)
        .then(function(result) {
          // console.log(">>>> MetricsFindQuery.process() - Metrics result");
          // console.log(result);
          var resultToReturn = _.map(result.data.results, function(resultEntry) {
            // console.log(">>> Metrics result entry ");
            // console.log(resultEntry);
            return {
              text: resultEntry.name,
              expandable: true
            };
          });
          // console.log(">>>> MetricsFindQuery.process() - Meta tags result");
          // console.log(resultToReturn);
          return resultToReturn;
        });
    }

    return null;
  };

  MetricFindQuery.prototype.labelValuesQuery = function(label, metric) {
    var url;

    if (!metric) {
      // return label values globally
      url = '/api/v1/label/' + label + '/values';

      return this.datasource._request('GET', url).then(function(result) {
        return _.map(result.data.data, function(value) {
          return {text: value};
        });
      });
    } else {
      var start = this.datasource.getTime(this.range.from, false);
      var end = this.datasource.getTime(this.range.to, true);
      url = '/api/v1/series?match[]=' + encodeURIComponent(metric)
        + '&start=' + start
        + '&end=' + end;

      return this.datasource._request('GET', url)
      .then(function(result) {
        return _.map(result.data.data, function(metric) {
          return {
            text: metric[label],
            expandable: true
          };
        });
      });
    }
  };

  MetricFindQuery.prototype.metricNameQuery = function(metricFilterPattern) {
    var url = '/api/v1/metrics/results';
    var data = {};
    return this.datasource._request('POST', url, data)
    .then(function(result) {
      return _.chain(result.data.data)
      .filter(function(metricName) {
        var r = new RegExp(metricFilterPattern);
        return r.test(metricName);
      })
      .map(function(matchedMetricName) {
        return {
          text: matchedMetricName,
          expandable: true
        };
      })
      .value();
    });
  };

  MetricFindQuery.prototype.queryResultQuery = function(query) {
    var end = this.datasource.getTime(this.range.to, true);
    var url = '/api/v1/query?query=' + encodeURIComponent(query) + '&time=' + end;

    return this.datasource._request('GET', url)
    .then(function(result) {
      return _.map(result.data.data.result, function(metricData) {
        var text = metricData.metric.__name__ || '';
        delete metricData.metric.__name__;
        text += '{' +
                _.map(metricData.metric, function(v, k) { return k + '="' + v + '"'; }).join(',') +
                '}';
        text += ' ' + metricData.value[1] + ' ' + metricData.value[0] * 1000;

        return {
          text: text,
          expandable: true
        };
      });
    });
  };

  MetricFindQuery.prototype.metricNameAndLabelsQuery = function(query) {
    var start = this.datasource.getTime(this.range.from, false);
    var end = this.datasource.getTime(this.range.to, true);
    var url = '/api/v1/series?match[]=' + encodeURIComponent(query)
      + '&start=' + start
      + '&end=' + end;

    var self = this;
    return this.datasource._request('GET', url)
    .then(function(result) {
      return _.map(result.data.data, function(metric) {
        return {
          text: self.datasource.getOriginalMetricName(metric),
          expandable: true
        };
      });
    });
  };

  return MetricFindQuery;
});

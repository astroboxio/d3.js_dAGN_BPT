var data, filters, extents;
var plot1, plot2, plot3;
var focus;

var body = d3.select('body');

// output
var output = d3.select('#output');

var sdssid_div = output.select('#SDSSID');
var sdssid_span = sdssid_div.select('span');
var sfr_div = output.select('#SFR');
var sfr_span = sfr_div.select('span');

// filters
var div_filters = d3.select('#filters');

// plots
var viz = d3.select('#viz').node();
var viz_height = parseInt(getComputedStyle(viz, null)['height']) ;

var svg_width = window.innerWidth;
var svg_height = viz_height;    // window.innerHeight;

var combo_padding = 40;
var plot_padding = 20;
var plot_width = (svg_width - 2 * combo_padding) / 3;
var plot_height = svg_height - 2 * combo_padding;

var svg =
    d3.select('#viz')
        .append('svg')
        .attr('width', svg_width)
        .attr('height', svg_height)
        ;

init();



function init() {
    d3.text('https://0fa2a39034f960516b8a86ee30ab3a67f011f64f.googledrive.com/host/0B5lt28Afi0VsdWxUdTBfX0hfZEE/data.csv', function(err, text) {
        if (err) {
            console.log('d3.text error: ', err);
            return;
        }
        data = d3.csv.parseRows(text);
        set_data();
        set_filters_controls();
        plot_1();
        plot_2();
        plot_3();
    });
}


function set_data() {
//    0      1              2           3        4     5          6         7         8        9
//    SDSSID Classification Peculiarity Redshift Type  logOIII_Hb logNII_Ha logSII_Ha logOI_Ha SFR
//    string pp | as        2 | A       number   2 | 3 number     number    number    number   number
    
    filters = {
        classification: {},
        peculiarity: {},
        type: {},
    };
    extents = {
        redshift: [],
        log_OIII_Hb: [],
        log_NII_Ha: [],
        log_SII_Ha: [],
        log_OI_Ha: [],
        SFR: []
    };
    data =
        _.chain(data)
        .map(function(row) {
            var obj = {
                SDSS_ID: row[0],
                classification: row[1],
                peculiarity: row[2],
                redshift: +row[3],
                type: row[4],
                log_OIII_Hb: +row[5],
                log_NII_Ha: +row[6],
                log_SII_Ha: +row[7],
                log_OI_Ha: +row[8],
                SFR: +row[9]
            };
            
            var band;
            var x = obj.log_NII_Ha;
            var y = obj.log_OIII_Hb;
            if (y < stravinska_NII(x)) {
                band = 'below_stravinska';
            } else if (y < kauffmann_fn(x)) {
                band = 'below_kauffmann';
            } else if (y < log_OIII_Hb_NII_fn(x)) {
                band = 'below_predicted';
            } else {
                band = 'above_predicted';
            }
            obj.band = band;
            
            _.each(extents, function(value, key, _extents) {
                _extents[key].push(obj[key]);
            });
            _.each(filters, function(value, key, _filters) {
                _filters[key][obj[key]] = true;
            });
            
            return obj;
        })
        .sortBy(function(item) {
            return -item.SFR;
        })
        .value()
        ;
    
    _.each(extents, function(value, key, _extents) {
        _extents[key] = d3.extent(value);
    });
}


function set_filters_controls() {
    
    var filtersData =
        _.map(filters, function(values, key) {
            return _.map(values, function(value, _key) {
                return {filter: key, name: _key};
            });
        });
//    [
//     [{"filter":"classification","name":"pp"},{"filter":"classification","name":"as"}],
//     [{"filter":"peculiarity","name":"2"},{"filter":"peculiarity","name":"A"}],
//     [{"filter":"type","name":"2"},{"filter":"type","name":"3"}]
//     ]
    
    var filter_div =
        div_filters.selectAll('.filter')
            .data(filtersData)
            .enter()
            .append('div')
            .classed('filter', true);
        
    filter_div.append('div')
        .classed('label', true)
        .append('span')
        .text(function(d, i) { return d[0].filter });
        
    filter_div.selectAll('.checkbox')
        .data(function(d, i) { return d })
        .enter()
        .append('div')
        .classed('checkbox', true)
        .append('span')
        .attr('class', function(d, i) {
            var _class;
            if (i === 0) {
                _class = 'left'
            } else if (i === _.size(filters[d.filter]) - 1) {
                _class = 'right'
            }
            return _class;
        })
        .classed('pressed', function(d, i) { return filters[d.filter][d.name] })
        .text(function(d) { return d.name })
        .on('click', filterClick)
        ;
    
    focus = div_filters.append('span');
};


function filterClick(d, i) {
    
    // toggle
    filters[d.filter][d.name] = !filters[d.filter][d.name];
    d3.select(this).classed('pressed', filters[d.filter][d.name]);
    
    _.each([plot1, plot2, plot3], function(plot) {
        plot.selectAll('circle')
            .classed({
                hidden: function(_d) {
                    var is_shown = true;
                    _.each(filters, function(value, filter) {
                        is_shown = is_shown && filters[filter][_d[filter]];
                    });
                    return !is_shown;
                },
            })
            ;
    });
}


function mouseover(d, i) {
    
    var duration = 150;
    
    div_filters.append('span')
        .attr('class', '_hoverinfo')
        .text(d.SDSS_ID + ' (z = ' + d.redshift + ', SFR: ' + d.SFR + ' M');
    div_filters.append('sub')
        .attr('class', '_hoverinfo solarmass')
        .text('⨀'); // http://en.wikipedia.org/wiki/Solar_mass
    div_filters.append('span')
        .attr('class', '_hoverinfo')
        .text('/yr)');
    _.each([plot1, plot2, plot3], function(plot) {
        plot.selectAll('circle')
            .classed({
                focused: function(_d) {
                    return _d.SDSS_ID === d.SDSS_ID;
                },
                dimmed: function(_d) {
                    return _d.SDSS_ID != d.SDSS_ID;
                },
            })
            ;
    });
}

function mouseout(d, i) {
    div_filters.selectAll('._hoverinfo').remove();
    _.each([plot1, plot2, plot3], function(plot) {
        
        plot.selectAll('circle')
            .classed({focused: false, dimmed: false})
            ;
    });
}

function plot_1() {
    
    
    // ===============
    // plot 1
    // ===============
    
    var plot_x = combo_padding;
    var plot_y = combo_padding;
    var padding_left = 20;
    var padding_right = 20;
    var padding_bottom = 15;
    var width = plot_width - padding_left - padding_right;
    var height = plot_height - padding_bottom;
    
    plot1 = svg.append('g')
        .attr('id', 'plot1')
        .attr('width', plot_width)
        .attr('height', plot_height)
        .attr('transform', 'translate(' + plot_x + ',' + plot_y + ')')
        .append('g')
        .attr('width', width)
        .attr('height', height)
        .attr('transform', 'translate(' + padding_left + ',' + 0 + ')')
        ;
    
    // scales
    
    var delta;
    
//    delta = (extents.log_NII_Ha[1] - extents.log_NII_Ha[0]) / 10;
//    var xPlotDomain = [extents.log_NII_Ha[0] - delta, extents.log_NII_Ha[1] + delta];
    var xPlotDomain = [-2.0, 1.5].concat([1.5]);
    var x =
        d3.scale.linear()
        .domain(xPlotDomain)
        .range([0, width]);
    
//    delta = (extents.log_OIII_Hb[1] - extents.log_OIII_Hb[0]) / 10;
//    var yPlotDomain = [extents.log_OIII_Hb[0] - delta, extents.log_OIII_Hb[1] + delta];
    var yPlotDomain = [-1.5, 2.5].concat([2.5]);
    var y =
        d3.scale.linear()
        .domain(yPlotDomain)
        .range([height, 0]);
    
    
    // generators
    
    var line =
        d3.svg.line()
            .interpolate('basis')
            .x(function(d) { return x(d.x); })
            .y(function(d) { return y(d.y); });
    
    
    // axis
    
    var xAxis =
        d3.svg.axis()
            .scale(x)
            .innerTickSize(-6)
            .outerTickSize(-height)
            .tickValues(d3.range(xPlotDomain[0], xPlotDomain[1], 0.5).concat([xPlotDomain[1]]))
            ;
    
    plot1.append('g')
        .attr('class', 'x axis noticksvalue')
        .call(xAxis.orient('top'));
    
    plot1.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + height + ')')
        .call(xAxis.orient('bottom'))
        .selectAll('.tick text')
        .attr('dy', '1em');
    
    plot1.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('transform', 'translate(' + (width/2) + ',' + (height + 2 * padding_bottom) + ')')
        .text('log([NII]/Hα)');
    
    var yAxis =
        d3.svg.axis()
            .scale(y)
            .innerTickSize(-6)
            .outerTickSize(-width)
            .tickValues(d3.range(yPlotDomain[0], yPlotDomain[1], 0.5).concat([yPlotDomain[1]]))
            ;
    
    plot1.append('g')
        .attr('class', 'y axis')
        .call(yAxis.orient('left'))
        .selectAll('.tick text')
        .attr('dx', '-0.25em');
    
    plot1.append('g')
        .attr('class', 'y axis noticksvalue')
        .attr('transform', 'translate(' + width + ',0)')
        .call(yAxis.orient('right'));
    
    plot1.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('transform', 'translate(' + (-2 * padding_left) + ',' + (height/2) + ') rotate(-90)')
        .text('log([NII]/Hβ)');
    
    
    // graphics
    
    var g1 = plot1.append('g');
        
    
    // curves
    
    _.each([-0.1, 0.1, 0], function(eps) {
        var xDomain = [
                       xPlotDomain[0],
                       _.min([xPlotDomain[1], log_OIII_Hb_NII_inverse_fn(yPlotDomain[0], eps)])
                       ];
        
        var step = (xDomain[1] - xDomain[0]) / 50;
        var xRange = d3.range(xDomain[0], xDomain[1], step);
        xRange.push(xDomain[1]);
        
        g1
            .append('path')
            .classed({curve: true, eps: eps})
            .datum( _.map(xRange, function(x) { return {x: x, y: log_OIII_Hb_NII_fn(x, eps)} }) )
            .attr('d', line)
            ;
    });
    
    
    // kauffman curve
    
    var xDomainKauffmann = [
                            _.max([log_OIII_Hb_NII_kauffmann_intersection_X_fn(0), xPlotDomain[0]]),
                            kauffmann_inverse_fn(yPlotDomain[0])
                            ];
    var stepKauffmann = (xDomainKauffmann[1] - xDomainKauffmann[0]) / 50;
    var xRangeKauffmann = d3.range(xDomainKauffmann[0], xDomainKauffmann[1], stepKauffmann);
    xRangeKauffmann.push(xDomainKauffmann[1]);
    
    g1
    .append('path')
    .classed({curve: true, kauff: true})
    .datum( _.map(xRangeKauffmann, function(x) { return {x: x, y: kauffmann_fn(x)} }) )
    .attr('d', line);
    
    
    // fill area
    
    var xDomainEps0 = [
                       log_OIII_Hb_NII_inverse_fn(yPlotDomain[0]),
                       _.max([log_OIII_Hb_NII_kauffmann_intersection_X_fn(0), xPlotDomain[0]]),
                       ];
    var step = (xDomainEps0[1] - xDomainEps0[0]) / 50;
    var xRangeEps0 = d3.range(xDomainEps0[0], xDomainEps0[1], step);
    xRangeEps0.push(xDomainEps0[1]);
    
    var path_d = line( _.map(xRangeKauffmann, function(x) { return {x: x, y: kauffmann_fn(x)} }) );
    path_d += ' L' + x(log_OIII_Hb_NII_inverse_fn(yPlotDomain[0])) + ',' + y(yPlotDomain[0]);
    path_d += line( _.map(xRangeEps0, function(x) { return {x: x, y: log_OIII_Hb_NII_fn(x)} }) );
    path_d += ' L' + x(xRangeKauffmann[0]) + ',' + y(kauffmann_fn(xRangeKauffmann[0]));
    path_d += 'Z';
    
    g1.insert('path', ":first-child")
        .classed({area: true})
        .attr('d', path_d);
    
    
    // stravinska_NII curve
    var xDomainStravinska = [
                            xPlotDomain[0],
                            find_stravinska_NII_intersection_X_fn(yPlotDomain[0], xPlotDomain[0])
                            ];
    var stepStravinska = (xDomainStravinska[1] - xDomainStravinska[0]) / 50;
    var xRangeStravinska = d3.range(xDomainStravinska[0], xDomainStravinska[1], stepStravinska);
    xRangeStravinska.push(xDomainStravinska[1]);
    
    g1
    .append('path')
    .classed({curve: true, stravinska: true})
    .datum( _.map(xRangeStravinska, function(x) { return {x: x, y: stravinska_NII(x)} }) )
    .attr('d', line);
    
    
    // dots
    
    g1.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
//        .attr('r', 2)
        .attr('r', function(d) { return 1 + d.SFR / 2 })
        .attr('cx', function(d) { return x(d.log_NII_Ha) })
        .attr('cy', function(d) { return y(d.log_OIII_Hb) })
        .attr('class', function(d) { return d.band })
        .classed({dot: true})
        .on('mouseover', mouseover)
        .on('mouseout', mouseout)
        ;
}



// ===============
// plot 2
// ===============

function plot_2() {
    
    var plot_x = combo_padding + plot_width;
    var plot_y = combo_padding;
    var padding_left = 0;
    var padding_right = 40;
    var padding_bottom = 15;
    var width = plot_width - padding_left - padding_right;
    var height = plot_height - padding_bottom;
    
    plot2 = svg.append('g')
        .attr('id', 'plot2')
        .attr('width', plot_width)
        .attr('height', plot_height)
        .attr('transform', 'translate(' + plot_x + ',' + plot_y + ')')
        .append('g')
        .attr('width', width)
        .attr('height', height)
        .attr('transform', 'translate(' + padding_left + ',' + 0 + ')')
        ;
    
    
    // scales
    
    var delta;
    
//    delta = (extents.log_SII_Ha[1] - extents.log_SII_Ha[0]) / 10;
//    var xPlotDomain = [extents.log_SII_Ha[0] - delta, extents.log_SII_Ha[1] + delta];
    var xPlotDomain = [-2.0, 1.5].concat([1.5]);
    var x =
        d3.scale.linear()
            .domain(xPlotDomain)
            .range([0, width]);
    
//    delta = (extents.log_OIII_Hb[1] - extents.log_OIII_Hb[0]) / 10;
//    var yPlotDomain = [extents.log_OIII_Hb[0] - delta, extents.log_OIII_Hb[1] + delta];
    var yPlotDomain = [-1.5, 2.5].concat([2.5]);
    var y =
        d3.scale.linear()
        .domain(yPlotDomain)
        .range([height, 0]);
    
    
    // generators
    
    var line =
        d3.svg.line()
            .interpolate('basis')
            .x(function(d) { return x(d.x); })
            .y(function(d) { return y(d.y); });
    
    
    // axis
    
    var xAxis =
        d3.svg.axis()
            .scale(x)
            .innerTickSize(-6)
            .outerTickSize(-height)
            .tickValues(d3.range(xPlotDomain[0], xPlotDomain[1], 0.5).concat([xPlotDomain[1]]))
            ;
    
    plot2.append('g')
        .attr('class', 'x axis noticksvalue')
        .call(xAxis.orient('top'));
    
    plot2.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + height + ')')
        .call(xAxis.orient('bottom'))
        .selectAll('.tick text')
        .attr('dy', '1em')
        ;
    
    plot2.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('transform', 'translate(' + (width/2) + ',' + (height + 2 * padding_bottom) + ')')
        .text('log([SII]/Hα)');
    
    var yAxis =
        d3.svg.axis()
            .scale(y)
            .innerTickSize(-6)
            .outerTickSize(-width)
            .tickValues(d3.range(yPlotDomain[0], yPlotDomain[1], 0.5).concat([yPlotDomain[1]]))
            ;
    
    plot2.append('g')
        .attr('class', 'y axis noticksvalue')
        .call(yAxis.orient('left'));
    
    plot2.append('g')
        .attr('class', 'y axis noticksvalue')
        .attr('transform', 'translate(' + width + ',0)')
        .call(yAxis.orient('right'));
    

    // graphics
    
    var g2 = plot2.append('g');
    
    
    // curves
    
    _.each([-0.1, 0.1, 0], function(eps) {
        var xDomain = [
                       xPlotDomain[0],
                       _.min([xPlotDomain[1], log_OIII_Hb_SII_inverse_fn(yPlotDomain[0], eps)])
//                       log_OIII_Hb_SII_inverse_fn(yPlotDomain[0], eps)
                       ];
        
        var step = (xDomain[1] - xDomain[0]) / 50;
        var xRange = d3.range(xDomain[0], xDomain[1], step);
        xRange.push(xDomain[1]);
        
        g2
            .append('path')
            .classed({curve: true, eps: eps})
            .datum( _.map(xRange, function(x) { return {x: x, y: log_OIII_Hb_SII_fn(x, eps)} }) )
            .attr('d', line)
            ;
    });
    
    
    // stravinska_SII curve
    var xDomainStravinska = [
                             _.min([stravinska_SII_inverse_fn(yPlotDomain[0]), xPlotDomain[1]]),
                            xPlotDomain[0],
                            ];
    var stepStravinska = (xDomainStravinska[1] - xDomainStravinska[0]) / 50;
    var xRangeStravinska = d3.range(xDomainStravinska[0], xDomainStravinska[1], stepStravinska);
    xRangeStravinska.push(xDomainStravinska[1]);
    
    g2
    .append('path')
    .classed({curve: true, stravinska: true})
    .datum( _.map(xRangeStravinska, function(x) { return {x: x, y: stravinska_SII_fn(x)} }) )
    .attr('d', line);
    
    
    // fill area
    
    var xDomainEps0 = [
                       xPlotDomain[0],
                       _.min([xPlotDomain[1], log_OIII_Hb_SII_inverse_fn(yPlotDomain[0])])
                       ];
    var step = (xDomainEps0[1] - xDomainEps0[0]) / 50;
    var xRangeEps0 = d3.range(xDomainEps0[0], xDomainEps0[1], step);
    xRangeEps0.push(xDomainEps0[1]);
    
    var path_d = line( _.map(xRangeEps0, function(x) { return {x: x, y: log_OIII_Hb_SII_fn(x)} }) );
    if (xDomainEps0[1] < log_OIII_Hb_SII_inverse_fn(yPlotDomain[0])) {
        path_d += ' L' + x(xPlotDomain[1]) + ',' + y(yPlotDomain[0]);
    }
    path_d += ' L' + x(stravinska_SII_inverse_fn(yPlotDomain[0])) + ',' + y(yPlotDomain[0]);
    path_d += line( _.map(xRangeStravinska, function(x) { return {x: x, y: stravinska_SII_fn(x)} }) );
    path_d += ' L' + x(xPlotDomain[0]) + ',' + y(log_OIII_Hb_SII_fn(xPlotDomain[0]));
    path_d += 'Z';
    
    g2.insert('path', ":first-child")
        .classed({area: true})
        .attr('d', path_d);
    
    // dots
    
    g2.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('r', function(d) { return 1 + d.SFR / 2 })
        .attr('cx', function(d) { return x(d.log_SII_Ha) })
        .attr('cy', function(d) { return y(d.log_OIII_Hb) })
        .attr('class', function(d) { return d.band })
        .classed({dot: true})
        .on('mouseover', mouseover)
        .on('mouseout', mouseout)
        ;
}

// ===============
// plot 3
// ===============

function plot_3() {
    
    var plot_x = combo_padding + 2 * plot_width;
    var plot_y = combo_padding;
    var padding_left = -20;
    var padding_right = 60;
    var padding_bottom = 15;
    var width = plot_width - padding_left - padding_right;
    var height = plot_height - padding_bottom;
    
    plot3 = svg.append('g')
        .attr('id', 'plot3')
        .attr('width', plot_width)
        .attr('height', plot_height)
        .attr('transform', 'translate(' + plot_x + ',' + plot_y + ')')
        .append('g')
        .attr('width', width)
        .attr('height', height)
        .attr('transform', 'translate(' + padding_left + ',' + 0 + ')')
        ;
    
    // scales
    var delta;
    
//    delta = (extents.log_OI_Ha[1] - extents.log_OI_Ha[0]) / 10;
//    var xPlotDomain = [extents.log_OI_Ha[0] - delta, extents.log_OI_Ha[1] + delta];
    var xPlotDomain = [-2.0, 1.5].concat([1.5]);
    var x =
        d3.scale.linear()
            .domain(xPlotDomain)
            .range([0, width]);
    
//    delta = (extents.log_OIII_Hb[1] - extents.log_OIII_Hb[0]) / 10;
//    var yPlotDomain = [extents.log_OIII_Hb[0] - delta, extents.log_OIII_Hb[1] + delta];
    var yPlotDomain = [-1.5, 2.5].concat([2.5]);
    var y =
        d3.scale.linear()
        .domain(yPlotDomain)
        .range([height, 0]);
    
    
    // generators
    
    var line =
        d3.svg.line()
            .interpolate('basis')
            .x(function(d) { return x(d.x); })
            .y(function(d) { return y(d.y); });
    
    
    // axis
    
    var xAxis =
        d3.svg.axis()
            .scale(x)
            .innerTickSize(-6)
            .outerTickSize(-height)
            .tickValues(d3.range(xPlotDomain[0], xPlotDomain[1], 0.5).concat([xPlotDomain[1]]))
            ;
    
    plot3.append('g')
        .attr('class', 'x axis noticksvalue')
        .call(xAxis.orient('top'));

    plot3.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + height + ')')
        .call(xAxis.orient('bottom'))
        .selectAll('.tick text')
        .attr('dy', '1em')
        ;
    
    plot3.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('transform', 'translate(' + (width/2) + ',' + (height + 2 * padding_bottom) + ')')
        .text('log([OI]/Hα)');

    var yAxis =
        d3.svg.axis()
            .scale(y)
            .innerTickSize(-6)
            .outerTickSize(-width)
            .tickValues(d3.range(yPlotDomain[0], yPlotDomain[1], 0.5).concat([yPlotDomain[1]]))
            ;
    
    plot3.append('g')
        .attr('class', 'y axis noticksvalue')
        .call(yAxis.orient('left'));

    plot3.append('g')
        .attr('class', 'y axis noticksvalue')
        .attr('transform', 'translate(' + width + ',0)')
        .call(yAxis.orient('right'));

    
    // graphics
    
    var g3 = plot3.append('g');
    
    // curves
    
    _.each([-0.1, 0, 0.1], function(eps) {
        var xDomain = [
                       xPlotDomain[0],
                       _.min([xPlotDomain[1], log_OIII_Hb_OI_inverse_fn(yPlotDomain[0], eps)])
                       ];
        
        var step = (xDomain[1] - xDomain[0]) / 50;
        var xRange = d3.range(xDomain[0], xDomain[1], step);
        xRange.push(xDomain[1]);
        
        g3
            .append('path')
            .classed({curve: true, eps: eps})
            .datum( _.map(xRange, function(x) { return {x: x, y: log_OIII_Hb_OI_fn(x, eps)} }) )
            .attr('d', line)
            ;
    });
    
    
    // dots
    
    g3.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('r', function(d) { return 1 + d.SFR / 2 })
        .attr('cx', function(d) { return x(d.log_OI_Ha) })
        .attr('cy', function(d) { return y(d.log_OIII_Hb) })
        .attr('class', function(d) { return d.band })
        .classed({dot: true})
        .on('mouseover', mouseover)
        .on('mouseout', mouseout)
        ;
}



//graph 1 curves
//--------------------

function log_OIII_Hb_NII_fn(n, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return 1.19 + eps + 0.61 / (n - eps - 0.47);
};

function log_OIII_Hb_NII_inverse_fn(y, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return 0.47 + eps + 0.61 / (y - eps - 1.19);
};


function kauffmann_fn(n, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    var result = 1.3 + eps + 0.61 /(n - eps - 0.05);
    return n > eps + 0.05 ? -2 : result;
};

function kauffmann_inverse_fn(y, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return 0.05 + eps + 0.61 /(y - eps - 1.3);
};

function log_OIII_Hb_NII_kauffmann_intersection_X_fn(eps) {
    /*
      log_OIII_Hb_NII
         y = (1.19 + eps) + 0.61 / (n - (eps + 0.47));
         y =       a      + b    / (n -      c      );
      kauffmann
         y = (1.30 + eps) + 0.61 / (n - (eps + 0.05));
         y =       d      + e    / (n -      f      );
     */
    var a = 1.19 + eps;
    var b = 0.61;
    var c = 0.47 + eps;
    var d = 1.30 + eps;
    var e = 0.61;
    var f = 0.05 + eps;
    
    var A = a - d;
    var B = b - e - (c + f) * (a - d);
    var C = e * c - b * f + c * f * (a - d);
    
    var xIntersection = (-B + Math.sqrt(Math.pow(B, 2) - 4 * A * C)) / (2 * A);
    
    return xIntersection
};

//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/tanh#Polyfill
function tanh(x) {
    if(x === Infinity) {
        return 1;
    } else if (x === -Infinity) {
        return -1;
    } else {
        var y = Math.exp(2 * x);
        return (y - 1) / (y + 1);
    }
}

function stravinska_NII(n) {
    return ( (-30.787 + 1.1358 * n + 0.27297 * Math.pow(n, 2)) * tanh(5.7409 * n) ) - 31.093;
};


function find_stravinska_NII_intersection_X_fn(y1, x0) {
    var deltaX = 0.1;
    var errY = 0.1;
    
    var y0 = stravinska_NII(x0);
    var x, y;
    var x_ = x0;
    var y_ = y0;
    
    var pre;
    
    // reach
    
    y = stravinska_NII(x0);
    while (Math.abs(y - y1) > errY) {
        x = x_ + deltaX;
        y = stravinska_NII(x);
        
        if (Math.abs(y - y_) >= errY) {
            while (Math.abs(y - y_) >= errY) {
                deltaX *= 0.9;
                x = x_ + deltaX;
                y = stravinska_NII(x);
            }
        } else {
            while (Math.abs(y - y_) < errY) {
                deltaX *= 1.1;
                x = x_ + deltaX;
                y = stravinska_NII(x);
            }
        }
        
        x_ = x;
        y_ = y;
        
        if (y > y1) {
            pre = {x: x_, y: y_};
        }
    }
    
    // refine
    
    errY /= 20;
    deltaX /= 10;
    
    x_ = pre.x;
    y_ = pre.y;
    y = pre.y;
    
    while (Math.abs(y - y1) > errY) {
        x = x_ + deltaX;
        y = stravinska_NII(x);
        
        if (Math.abs(y - y_) >= errY) {
            while (Math.abs(y - y_) >= errY) {
                deltaX *= 0.9;
                x = x_ + deltaX;
                y = stravinska_NII(x);
            }
        } else {
            while (Math.abs(y - y_) < errY) {
                deltaX *= 1.1;
                x = x_ + deltaX;
                y = stravinska_NII(x);
            }
        }
        
        x_ = x;
        y_ = y;
        
        if (y > y1) {
            pre = {x: x_, y: y_};
        }
    }
    
    return pre.x;
}



//graph 2 curves
//--------------------

function log_OIII_Hb_SII_fn(n, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return 1.30 + eps + 0.72 / (n - eps - 0.32);
};

function log_OIII_Hb_SII_inverse_fn(y, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return 0.32 + eps + 0.72 / (y - eps - 1.3);
};

function stravinska_SII_fn(n, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return 1.2 + eps + 0.61 / (n - eps + 0.2)
};


function stravinska_SII_inverse_fn(y, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return -0.2 + eps + 0.61 / (y - eps - 1.2);
};


//graph 3 curves
//--------------------

function log_OIII_Hb_OI_fn(n, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return 1.33 + eps + 0.73 / (n - eps + 0.59);
};

function log_OIII_Hb_OI_inverse_fn(y, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return -0.59 + eps + 0.73 / (y - eps - 1.33);
};


/*
// ===============
// plot 4
// ===============

// graph 4 curves
// --------------------

function log_OIII_OII_OI_fn(n) {
    return -1.701 * n - 2.163;
};



function log_OI_Ha_fn(n) {
    return 1.0 * n + 0.7;
};

function plot4() {
    
    var plot_x = combo_padding + 3 * plot_width;
    var plot_y = combo_padding;
    var padding_left = 20;
    var padding_right = 20;
    var padding_bottom = 15;
    var width = plot_width - padding_left - padding_right;
    var height = plot_height - padding_bottom;
    
    p4 = svg.append('g')
        .attr('id', 'plot4')
        .attr('width', plot_width)
        .attr('height', plot_height)
        .attr('transform', 'translate(' + plot_x + ',' + plot_y + ')')
        .append('g')
        .attr('width', width)
        .attr('height', height)
        .attr('transform', 'translate(' + padding_left + ',' + 0 + ')')
        ;
    
    
    // scales
    
    var x =
        d3.scale.linear()
            .domain([-2.5, 0.0])
            .range([0, width]);
    
    var y =
        d3.scale.linear()
        .domain([-1.5, 1.2])    // !!! Michael's was [-1.5, 1.0], but dots were off above
        .range([height, 0]);
    
    
    // generators
    
    var line =
        d3.svg.line()
            .interpolate('basis')
            .x(function(d) { return x(d.x); })
            .y(function(d) { return y(d.y); });
    
    
    // axis
    
    var xAxis =
        d3.svg.axis()
            .scale(x)
            .innerTickSize(-6)
            .outerTickSize(-height)
            .tickValues(d3.range(xPlotDomain[0], xPlotDomain[1], 0.5).concat([xPlotDomain[1]]))
            ;
    
    p4.append('g')
        .attr('class', 'x axis noticksvalue')
        .call(xAxis.orient('top'));

    p4.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + height + ')')
        .call(xAxis.orient('bottom'))
        .selectAll('.tick text')
        .attr('dy', '1em')
        ;
    
    p4.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('transform', 'translate(' + (width/2) + ',' + (height + 2 * padding_bottom) + ')')
        .text('log([OI]/Hα)');
    
    var yAxis =
        d3.svg.axis()
            .scale(y)
            .orient('left')
            .innerTickSize(-6)
            .outerTickSize(-width)
            .tickValues(d3.range(yPlotDomain[0], yPlotDomain[1], 0.5).concat([yPlotDomain[1]]))
            ;
    
    p4.append('g')
        .attr('class', 'y axis')
        .call(yAxis.orient('left'))
        .selectAll('.tick text')
        .attr('dx', '-0.25em');

    p4.append('g')
        .attr('class', 'y axis noticksvalue')
        .attr('transform', 'translate(' + width + ',0)')
        .call(yAxis.orient('right'));
    
    p4.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('transform', 'translate(' + (-2 * padding_left) + ',' + (height/2) + ') rotate(-90)')
        .text('log([OIII]/[OII])');
    
    // graphics
    
    var g4 = p4.append('g').attr('clip-path', 'url(#plot4clip)');
    
    
    // curves
    
    // A path, eps = 0, solid black
    g4
        .append('path')
        .classed({curve: true})
        .datum( _.map(OI2, function(x) { return {x: x, y: log_OIII_OII_OI_fn(x)} }) )
        .attr('d', line);
    
    // B path, eps = 0.1, dashed black
    g4
        .append('path')
        .classed({curve: true, eps: true})
        .datum( _.map(Ha, function(x) { return {x: x, y: log_OI_Ha_fn(x)} }) )
        .attr('d', line);
    
    // horizontal line
    g4
        .append('line')
        .classed({axline: true})
        .attr('x1', 0)
        .attr('y1', y(0))
        .attr('x2', width)
        .attr('y2', y(0));
    
    
    // dots
    
    var data_log_OIHa = _.map(log_OIHa, function(n, i) {
        return {
            SDSS_ID: SDSS_ID[i],
            x: n,
            y: log_OIIIOII[i],
            is_above_predicted: log_OIIIHb[i] > log_OIII_Hb_NII_fn(n, 0),
            SFR: SFR[i]
        };
    });
    
    g4.selectAll('circle')
        .data(data_log_OIHa)
        .enter()
        .append('circle')
        .attr('r', 2)
        .attr('cx', function(d) { return x(d.x) })
        .attr('cy', function(d) { return y(d.y) })
        .classed({
            dot: true,
            above: function(d) { return d.is_above_predicted }
        })
        .on('mouseover', mouseover)
        .on('mouseout', mouseout)
        ;
}
    
*/

var d3 = require('../bower_components/d3/d3'),
    queue = require('../bower_components/queue-async/queue'),
    _ = require('../bower_components/lodash/dist/lodash'),
    React = require('../bower_components/react/react.js');

var Container = require('./Container');
var LogicState = require('./LogicState');
var Process = require('./Process');
var DataSpace = require('./DataSpace.js');
var DataSet = require('./DataSet');

var processJson = function(res) {
    var allLinks = [],
        allNodes = [],
        containers = {};

    _.each(res, function(cnt) {
        var c = new Container(cnt);
        allNodes.push(c);

        _.each(c.logicStates(), function(v) {
            allNodes.push(v);
            allLinks.push({source: c, target: v});
        });

        _.each(c.processes(), function(v) {
            allNodes.push(v);
            allLinks.push({source: c, target: v});
        });

        _.each(c.dataSpaces(), function(v) {
            allNodes.push(v);
            allLinks.push({source: c, target: v});
        });

        _.each(c.dataSets(), function(v) {
            allNodes.push(v);
            allLinks.push({source: c, target: v});
        });

        // FIXME assumes hostname is uuid
        containers[cnt.hostname] = c;
    });

    // All hierarchical data is processed; second pass for referential.
    _.forOwn(containers, function(cv) {
        // find logic refs to data
        _.each(cv.logicStates(), function(l) {
            if (_.has(l, 'datasets')) {
                _.forOwn(l.datasets, function(dv, dk) {
                    var link = _.assign({source: l, name: dk}, dv);
                    var proc = false;
                    // check for hostname, else assume path
                    if (_.has(dv.loc, 'hostname')) {
                        if (_.has(containers, dv.loc.hostname)) {
                            proc = containers[dv.loc.hostname].findProcess(dv.loc);
                        }
                    } else {
                        proc = cv.findProcess(dv.loc);
                    }

                    if (proc) {
                        link.target = proc;
                        allLinks.push(link);
                    }
                });
            }
        });

        // next, link processes to logic states & data spaces
        _.each(cv.processes(), function(proc) {
            _.each(proc.logicStates(), function(ls) {
                allLinks.push({source: proc, target: ls});
            });

            _.each(proc.dataSpaces(), function(ds) {
                allLinks.push({source: proc, target: ds});
            });
        });

        _.each(cv.dataSpaces(), function(dg) {
            _.each(dg.dataSets(), function(ds) {
                // direct tree/parentage info
                allLinks.push({source: dg, target: ds});
                // add dataset genesis information
                if (ds.genesis !== "α") {
                    var link = {source: ds};
                    var ods = false;
                    if (_.has(ds.genesis, 'hostname')) {
                        if (_.has(containers, ds.genesis.hostname)) {
                            ods = containers[ds.genesis.hostname].findDataSet(ds.genesis);
                        }
                    } else {
                        ods = cv.findDataSet(ds.genesis);
                    }

                    if (ods) {
                        link.target = ods;
                        allLinks.push(link);
                    }
                }
            });
        });
    });

    return {links: allLinks, nodes: allNodes, containers: containers};
};

var graphRender = function(el, state, props) {
    var link = d3.select(el).selectAll('.link')
            .data(state.force.links()),
        node = d3.select(el).selectAll('.node')
            .data(state.force.nodes());

    link.enter().append('line')
        .attr('class', 'link');

    var nodeg = node.enter().append('g')
        .attr('class', function(d) {
            return 'node ' + d.vType();
        });

    nodeg.append('circle')
        .attr('x', 0)
        .attr('y', 0)
        .attr('r', function(d) {
            if (d instanceof Container) {
                return 45;
            }
            if (d instanceof LogicState) {
                return 30;
            }
            if (d instanceof DataSet) {
                return 30;
            }
            if (d instanceof DataSpace) {
                return 30;
            }
            if (d instanceof Process) {
                return 37;
            }
        })
        .on('click', props.target);

    nodeg.append('text')
        .text(function(d) { return d.name(); });

    node.exit().remove();
    link.exit().remove();

    state.force.on('tick', function() {
        link.attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        node.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    });

    state.force.start();
    return false;
};

var Viz = React.createClass({
    displayName: "pipeviz-graph",
    getInitialState: function() {
        return {
            force: d3.layout.force()
                .charge(-3000)
                .chargeDistance(250)
                .size([this.props.width, this.props.height])
                .linkStrength(function(link) {
                    if (link.source instanceof Container) {
                        return 1;
                    }
                    return 0.5;
                })
        };
    },
    getDefaultProps: function() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            nodes: [],
            links: [],
            target: function() {}
        };
    },
    render: function() {
        return React.DOM.svg({
            className: "pipeviz",
            viewBox: "0 0 " + this.props.width + " " + this.props.height
        });
    },
    componentDidUpdate: function() {
        this.state.force.nodes(this.props.nodes);
        this.state.force.links(this.props.links);

        return graphRender(this.getDOMNode(), this.state, this.props);
    },
    shouldComponentUpdate: function(nextProps, nextState) {
        // TODO probably a suboptimal way to do this compare...?
        if (nextProps.nodes !== this.state.force.nodes()) {
            return true;
        }
        if (nextProps.links !== this.state.force.links()) {
            return true;
        }
        return false;
    }
});

var InfoBar = React.createClass({
    displayName: 'pipeviz-info',
    render: function() {
        if (typeof this.props.target !== 'object') {
            return (<div id="infobar"><p>nothing selected</p></div>);
        }

        return (<div id="infobar"><p>{this.props.target.toString()}</p></div>);
    }
});

var App = React.createClass({
    displayName: 'pipeviz',
    getInitialState: function() {
        return {
            nodes: [],
            links: [],
            containers: {},
            target: undefined
        }
    },
    targetNode: function(event) {
        this.setState({target: event});
    },
    render: function() {
        return (
            <div id="pipeviz">
                <Viz width={window.innerWidth * 0.83} height={window.innerHeight} nodes={this.state.nodes} links={this.state.links} target={this.targetNode}/>
                <InfoBar width="16.7%" target={this.state.target}/>
            </div>
        );
    },
    componentDidMount: function() {
        var cmp = this;

        // TODO this whole retrieval/population pattern will all change
        d3.json('fixtures/ein/container.json', function(err, res) {
            if (err) {
                return;
            }

            cmp.setState(processJson(res));
        });
    }
});

React.renderComponent(App(), document.body);

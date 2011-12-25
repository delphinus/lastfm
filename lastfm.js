'use strict';

// you need strftime.js to display time neatly
if (!Date.prototype.strftime) {
    Date.prototype.strftime = function(){
        return this.toString();
    };
}

// for debug
if (!window.console) {
    window.console = {
        log: $.noop()
    };
}

// array for instances
window.lfmObjs = [];


// start definition
(function($){


    // for debug
var _log = function(msg) {
        if (window.TEST_MODE && window.console) {
            console.log(msg);
        } else {
            return false;
        }
    }

    // constructor
    ,LFM = function(options, container) {
        this.init(options, $(container));
        this.updatetracks();
    }
;

LFM.prototype = {
    // default option values
    defaults: { //{{{
        // Last.FM query URL
        queryURL: 'http://ws.audioscrobbler.com/2.0/?callback=?'
        // account name to display
        ,username: 'delphinus_iddqd'
        // Last.FM API Key
        ,apikey: 'fca0142adfe95a7fb622a63d28b7d1a5'
        // number of tracks to display
        ,number: 10
        // size of pictures
        ,artSize: 'medium'
        // for tracks that have no pictures
        ,noart: '/images/noartwork.gif'
        // if true, artist arts are displayed instead of album arts
        // when tracks have no album arts.
        ,showArtistArt: true
        // if true, list is being updated in some interval.
        ,autoUpdate: true
        // if autoUpdate is true, this interval is used.
        // you can use prefix: h => hours, m => minutes, s => seconds
        ,updateInterval: '1m'
        // if true, tracks will appear in order with fade-in effect.
        ,drawDelay: true
        // duration for showing of tracks.
        // this must be specified in milliseconds.
        ,showInterval: 500
        // callback to be called when query has finished.
        ,onComplete: function(){}
    } //}}}

    // initialization
    ,init: function(options, $container) { //{{{
        var lfm, name, item, j
            ,i = -1
            ,options = $.extend({}, this.defaults, options)
        ;

        // translate updateInterval to integer
        options.updateInterval = parseNum(options.updateInterval);

        // scan LFM instances.
        // if you discover object for target DOM, it will be used.
        while (lfm = window.lfmObjs[++i]) {
            if ($container.hasClass(lfm.name)) {
                break;
            }
        }

        // if object has found
        if (i < window.lfmObjs.length) {
            // stop timers
            for (j in lfm.timer) {
                clearInterval(lfm.timer[j]);
            }

            // remove label for next update
            if (lfm.$timerLabel) {
                lfm.$timerLabel.remove();
            }

            // replace object with `this'
            name = lfm.name;
            item = lfm.item;
            window.lfmObjs[i] = this;

        // add className consisting of timestamp to object 
        } else {
            name = 'LFM-' + $.now();
            $container.addClass(name);

            item = $container.html();

            // push to array of LFM instances
            window.lfmObjs.push(this);
        }

        $container.children().remove();

        // options
        $.extend(this, {
            $container   : $container
            ,$timerLabel : null
            ,name        : name
            ,item        : item
            ,options     : options
            ,updating    : false
            ,lastRemoved : null
            ,t           : {}
            ,tracks      : []
            ,timer       : {
                main: null
                ,sub: null
            }
            ,imgSize     : options.artSize == 'small' ? 0 :
                options.artSize == 'medium' ? 1 :
                options.artSize == 'large' ? 2 :
                0
        });
    } //}}}

    // function for displaying tracks
    ,updatetracks: function() { // {{{
        var tracks
        ;

        this.t = setEpoch(this.options.updateInterval);

        // auto update
        if (this.options.autoUpdate) {
            var label;

            // label for next update time
            if (!this.$timerLabel) {
                var label = $('<div/>')
                    .addClass('lfm_update')
                    .appendTo(this.$container.parent());
                label.attr({id: 'LFM_timer-' + $.now()});

                this.$timerLabel = label;
            }

            // display time for next update
            if (!this.timer.sub) {
                this.timer.sub = setInterval(
                    scope(function() {
                        var sec = parseInt(
                                this.t.next - $.now() / 1000)
                            ,text = sec <= 0 ? 'loading...'
                                : new Date(this.t.next * 1000)
                                        .strftime('next update: %r ')
                                    + '( ' + sec + 's )';
                        ;
                        this.$timerLabel.text(text);
                    }, this), 1000);
            }

            // reservation of update
            this.timer.main = setTimeout(scope(this.updatetracks, this)
                ,this.options.updateInterval * 1000);
        }

        // avoid duplication of updates
        if (this.updating) {
            return;
        } else {
            this.updating = true;
        }

        // query for tracks to Last.FM
        $.getJSON(this.options.queryURL, {
            method      : 'user.getrecenttracks'
            ,format     : 'json'
            ,user       : this.options.username
            ,api_key    : this.options.apikey
            ,limit      : this.options.number
            ,nowplaying : true
            // avoid duplication of tracks.
            // get tracks which played after this timestamp.
            ,from       : this.tracks.length > 0 ?
                this.tracks[this.tracks[0].uts == 0 ? 1 : 0].uts : 0

        }, scope(function(data) {
            // quit in errors
            if (data.error) {
                return this.handleError(data);
            }

            // display tracks
            if ($.isArray(data.recenttracks.track)) {
                // remove `now playing' track
                if (this.tracks.length > 0 && this.tracks[0].uts == 0) {
                    this.tracks.shift().$item.remove();
                }

                $.each(data.recenttracks.track.reverse()
                    ,scope(this.displaytrack, this));
            }

            // update playback time
            this.updateTime();
        }, this))

        // update finished
        .complete(scope(function() {
            this.updating = false;
        }, this))
        ;
    } //}}}

    // display info of tracks
    ,displaytrack: function(i, info) { //{{{
        var then, seconds, minutes, $art, lastTrack
            ,interval = this.options.drawDelay
                ? this.options.showInterval * i : 0
            ,showArtistImage = false
            ,track = {
                url: stripslashes(info.url)
                ,song: info.name
                ,artist: info.artist['#text']
                ,album: info.album['#text']
                ,uts: info['@attr'] && info['@attr'].nowplaying
                    ? 0 : info.date.uts
            }
        ;

        // box of track info
        track.$item = $(this.item).prependTo(this.$container).hide();

        // diplay title, artist, and album
        $('.lfm_song',   track.$item).text(track.song);
        $('.lfm_artist', track.$item).text(track.artist);
        $('.lfm_album',  track.$item).text(track.album);

        // link to Last.FM
        $('a', track.$item).attr({
            href: track.url
            ,title: 'Listen to ' + track.name + ' on Last.FM'
            ,target: '_blank'
        });

        // remove tracks to excess
        if (this.tracks.length + 1 > this.options.number) {
            this.tracks.pop().$item.delay(interval).remove();
        }

        // fade-in display
        if (interval) {
            track.$item.delay(interval).fadeIn('slow');
        } else {
            track.$item.show();
        }

        // search album arts
        try {
            track.art = stripslashes(info.image[this.imgSize]['#text']);
            if (!track.art) {
                throw 0;
            }

        // another one
        } catch (e) {
            track.art = this.options.noart;
            showArtistImage = true;
        }

        // if `showArtistImage' options is true,
        // search artist image when you can't find album arts.
        $art = $('.lfm_art', track.$item);
        if (showArtistImage && this.options.showArtistArt) {
            $.getJSON(this.options.queryURL, {
                method: 'artist.getimages'
                ,format: 'json'
                ,artist: track.artist
                ,api_key: this.options.apikey
                ,limit: 1
            }, curry(this.drawimage, this)($art));

        // usual image flow
        } else {
            imgTag($art, track.art, track.album);
        }

        // store for next update
        this.tracks.unshift(track);

        // execute callback when complete displaying
        if (i == this.options.number - 1) {
            this.options.onComplete.call(this);
        }
    } //}}}

    // update playback time
    ,updateTime: function() { //{{{
        $.each(this.tracks, scope(function(i, track) {
            var then, seconds, minutes
            ;

            // `now playing'
            if (track.uts == 0) {
                seconds = -1;

            } else {
                then = new Date(track.uts * 1000)
                seconds = this.t.now - track.uts
                minutes = parseInt(seconds / 60)
            }

            // format time
            $('.lfm_datetime', track.$item).text(
                seconds < 0
                    ? 'now playing' :
                seconds < 600
                    ? 'just listened' :
                seconds < 3600
                    ? minutes + ' minute' + (minutes == 1 ? '' : 's') + ' ago' :
                track.uts >= this.t.today
                    ? then.strftime('Today %I:%M %p') :
                track.uts >= this.t.yesterday
                    ? then.strftime('Yesterday %I:%M %p') :
                track.uts >= this.t.lastWeek
                    ? then.strftime('%A %I:%M %p') :
                track.uts >= this.t.thisYear
                    ? then.strftime('%m/%d %I:%M %p') :
                track.uts >= this.t.lastYear
                    ? then.strftime('Last Year %m/%d %I:%M %p') :
                      then.strftime('%Y/%m/%d %I:%M %p')
            );
        }, this));
    } //}}}

    // search for artist art
    ,drawimage: function($art, data) { //{{{
        var i = 0
            ,sizes ,img
        ;

        try {
            sizes = data.images.image.sizes.size;

            // search specified size of images
            while (sizes[i].name.indexOf(this.options.artSize, 0) < 0 ) {
                i++;
            }
            img = sizes[i]['#text'];
            imgTag($art, stripslashes(img), data.images['@attr'].artist);

        // if not found, use `noart image'
        } catch (e) {
            imgTag($art, this.options.noart);
        }
    } //}}}

    // show erros
    ,handleError: function(data) { //{{{
        this.$container.children().remove();
        var $item = $(this.item).prependTo(this.$container);
        $('.lfm_song',   $item).text('error: '   + data.error);
        $('.lfm_artist', $item).text('message: ' + data.message);
    } //}}}
};

// parse time string
function parseNum(i) { //{{{
    i = i + '';
    return (
        i.match(/(\d+)h$/i) ? RegExp.$1 * 3600 :
        i.match(/(\d+)m$/i) ? RegExp.$1 * 60   :
        i.match(/(\d+)s$/i) ? RegExp.$1 * 1    :
        i.match(/(\d+)/)    ? RegExp.$1 * 1    : 600
    );
} //}}}

// prepare various timestamps
function setEpoch(num) { //{{{
    var now = new Date()
        ,t = {
            now       : now
            ,today    : new Date(now.getTime())
            ,yesterday: new Date(now.getTime() - 86400 * 1000)
            ,lastWeek : new Date(now.getTime() - 6 * 86400 * 1000)
            ,thisYear : new Date(now.getTime())
            ,lastYear : new Date(now.getTime() - 365 * 86400)
            ,next     : new Date(now.getTime() + num * 1000)
        }
        ,k
    ;

    $.each('today yesterday lastWeek thisYear lastYear'.split(/\s/)
        ,function() {
            t[this].setHours(0);
            t[this].setMinutes(0);
            t[this].setSeconds(0);
        }
    );

    $.each('thisYear lastYear'.split(/\s/), function() {
        t[this].setMonth(0);
        t[this].setDate(1);
    });

    for (k in t) {
        t[k] = t[k].getTime() / 1000;
    }
    return t;
} //}}}

// remove backslashes
function stripslashes(str) { //{{{
    return (str + '')
        .replace(/\0/g, '0')
        .replace(/\\([\\'"])/g, '$1');
} //}}}

// insert <img>
function imgTag($item, url, alt) { //{{{
    $('<img/>')
        .attr({
            src: url
            ,alt: alt ? alt : null
        })
        .appendTo($item)
    ;
} //}}}

// bogus prototype.js's bind() ;)
function scope(f, t) { //{{{
    return function(){
        return f.apply(t, arguments);
    };
} //}}}

// JavaScript currying
// http://nanto.asablo.jp/blog/2008/02/14/2626240
function curry(f, t) { //{{{
    t = t || window;
    if (f.length == 0) {
        return f;
    }

    var iterate = function(args) {
        if (args.length >= f.length) {
            return f.apply(t, args);
        }

        return function () {
            return iterate(args.concat(
                Array.prototype.slice.call(arguments)));
        };
    };

    return iterate([]);
} //}}}


// register LFM method
$.fn.lastFM = function(options) { //{{{
    $(this).each(function() {
        new LFM(options, this);
    });
} //}}};


})(jQuery);

// vim:se fdm=marker:

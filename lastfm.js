'use strict';

// strftime.js が読み込まれてないときの対処
if (!Date.prototype.strftime) {
    Date.prototype.strftime = function(){
        return this.toString();
    };
}

// デバッグコンソール
if (!window.console) {
    window.console = {
        log: function(){}
    };
}

// Last.FM オブジェクトを納める配列
window.lfmObjs = [];

(function($){

    // デバッグ用関数
var _log = function(msg) {
        if (!window.TEST_MODE || !window.console) {
            return false;
        }
        console.log(msg);
    }

    // コンストラクタ
    ,LFM = function(options, container) {
        this.init(options, $(container));
        this.updatetracks();
    }
;

LFM.prototype = {
    // オプションの初期値
    defaults: {
        // アカウント名
        username: 'delphinus_iddqd'
        // Last.FM API Key
        ,apikey: 'fca0142adfe95a7fb622a63d28b7d1a5'
        // 表示するトラック数
        ,number: 10
        // 表示する画像の大きさ
        ,artSize: 'medium'
        // 画像が見つからないときの代替画像
        ,noart: '/images/noartwork.gif'
        // アルバムアートが見つからないときはアーティストの画像を表示する
        ,showArtistArt: true
        // 自動更新する
        ,autoUpdate: true
        // 更新間隔
        ,updateInterval: '1m'
        // 表示を遅らせる
        ,drawDelay: true
        // 遅らせる間隔（単位：ミリセカンド）
        ,fadeDuration: 500
        // 完了したときに実行する関数
        ,onComplete: function(){}
    }

    // 初期設定
    ,init: function(options, $container) {
        var lfm, name, item, found
            ,i = 0
            ,defaults = this.defaults
            ,options = $.extend({}, defaults, options)
        ;

        options.updateInterval = parseNum(options.updateInterval);

        // 今までに作成した LFM オブジェクトの一覧を走査して
        // 対象の要素に対応する LFM オブジェクトがすでに存在するならばそれを使う
        while (lfm = lfmObjs[i]) {
            if ($container.hasClass(lfm.name)) {
                found = true;
                break;
            } else {
                i++;
            }
        }

        if (found) {
            // タイマーが稼働しているなら止める
            for (i in lfm.timer) {
                clearInterval(lfm.timer[i]);
            }

            // 更新時刻表示ラベルがあれば消しておく
            if (lfm.$timerLabel) {
                lfm.$timerLabel.remove();
            }

            name = lfm.name;
            item = lfm.item;

        // 初めて設定するオブジェクトには
        // タイムスタンプから生成したクラス名を付ける
        } else {
            name = 'LFM-' + new Date().getTime();
            $container.addClass(name);

            item = $container.html();

            // 作成したらオブジェクトを集めた配列に push
            window.lfmObjs.push(this);
        }

        $container.children().remove();

        // オプション設定
        $.extend(this, {
            $container: $container
            ,$timerLabel: null
            ,name: name
            ,item: item
            ,options: options
            ,updating: false
            ,lastRemoved: null
            ,t: {}
            ,tracks: []
            ,timer: {
                main: null
                ,sub: null
            }
            ,imgSize: options.artSize == 'small' ? 0 :
                options.artSize == 'medium' ? 1 :
                options.artSize == 'large' ? 2 :
                0
        });
    }

    // 実際に表示を更新する関数
    ,updatetracks: function() {
        var tracks
        ;

        this.t = setEpoch(this.options.updateInterval);

        // 次の更新を予約
        if (this.options.autoUpdate) {
            // 時刻表示ラベルの追加
            if (!this.$timerLabel) {
                this.$timerLabel = $('<div/>')
                    .addClass('lfm_update')
                    .appendTo(this.$container.parent());
            }

            // 次の更新までの残り時間を表示
            if (!this.timer.sub) {
                this.timer.sub = setInterval(
                    scope(function() {
                        var sec = parseInt(
                                this.t.next - new Date().getTime() / 1000)
                            ,text = sec <= 0 ? 'loading...'
                                : new Date(this.t.next * 1000)
                                        .strftime('next update: %r ')
                                    + '( ' + sec + 's )';
                        ;
                        this.$timerLabel.text(text);
                    }, this), 1000);
            }

            // 次の更新を予約
            this.timer.main = setTimeout(scope(this.updatetracks, this)
                ,this.options.updateInterval * 1000);
        }

        // 前回の更新が終わっていないならここで戻る
        if (this.updating) {
            return;
        } else {
            this.updating = true;
        }

        $.getJSON('http://ws.audioscrobbler.com/2.0/?callback=?', {
            method: 'user.getrecenttracks'
            ,format: 'json'
            ,user: this.options.username
            ,api_key: this.options.apikey
            ,limit: this.options.number
            ,nowplaying: true
            // すでに読んだことがあるならば、
            // 一番新しいもの以降を読む
            ,from: this.tracks.length > 0 ?
                        this.tracks[this.tracks[0].uts == 0 ? 1 : 0].uts : 0

        }, scope(function(data) {
            // エラーが起こったらメッセージだけ表示して終了
            if (data.error) {
                return this.handleError(data);
            }

            // トラックごとに表示する
            if ($.isArray(data.recenttracks.track)) {
                // “now playing”が残っていたら予め消しておく
                if (this.tracks.length > 0 && this.tracks[0].uts == 0) {
                    this.tracks.shift().item.remove();
                }

                $.each(data.recenttracks.track.reverse()
                    ,scope(this.displaytrack, this));
            }

            // 再生時刻を更新
            this.updateTime();
        }, this))

        // 終了処理
        .complete(function() {
            this.updating = false;
        })
        ;
    }

    // トラックの情報を表示する
    ,displaytrack: function(i, info) {
        var then, seconds, minutes, $art, lastTrack
            ,interval = this.options.drawDelay
                ? this.options.fadeDuration * i : 0
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

        // トラックの情報を表示するコンテナを追加
        track.$item = $(this.item).prependTo(this.$container).hide();

        // 曲名・アーティスト名・アルバム名を表示
        $('.lfm_song',   track.$item).text(track.song);
        $('.lfm_artist', track.$item).text(track.artist);
        $('.lfm_album',  track.$item).text(track.album);

        // Last.FMへのリンクを貼る
        $('a', track.$item).attr({
            href: track.url
            ,title: 'Listen to ' + track.name + ' on Last.FM'
            ,target: '_blank'
        });

        // 溢れた分を削除
        if (this.tracks.length + 1 > this.options.number) {
            this.tracks.pop().$item.delay(interval).remove();
        }
        // 表示を（遅らせながら）開始
        track.$item.delay(interval).fadeIn('slow');

        // アルバムアートの表示
        try {
            track.art = stripslashes(info.image[this.imgSize]['#text']);
            if (!track.art) {
                throw 0;
            }

        // 見つからなければこっち
        } catch (e) {
            track.art = this.options.noart;
            showArtistImage = true;
        }

        // アルバムの画像が見つからず、しかもアーティストの画像を
        // 表示する設定ならば探しに行く
        $art = $('.lfm_art', track.$item);
        if (showArtistImage && this.options.showArtistArt) {
            $.getJSON('http://ws.audioscrobbler.com/2.0/?callback=?', {
                method: 'artist.getimages'
                ,format: 'json'
                ,artist: track.artist
                ,api_key: this.options.apikey
                ,limit: 1
            }, curry(this.drawimage, this)($art));

        // そうでなければこっち
        } else {
            imgTag($art, track.art, track.album);
        }

        // トラック一覧に情報を追加
        this.tracks.unshift(track);

        // 全部終わったらコールバックを実行する
        if (i == this.options.number - 1) {
            this.options.onComplete.call(this);
        }
    }

    // 再生時刻の表示を更新する
    ,updateTime: function() {
        $.each(this.tracks, scope(function(i, track) {
            var then, seconds, minutes
            ;

            if (track.uts == 0) {
                seconds = -1;

            } else {
                then = new Date(track.uts * 1000)
                seconds = this.t.now - track.uts
                minutes = parseInt(seconds / 60)
            }

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
    }

    // アーティストの画像を探して表示する
    ,drawimage: function($art, data) {
        var i = 0
            ,sizes ,img
        ;

        try {
            sizes = data.images.image.sizes.size;
            // 設定されたサイズの画像を探す
            while (sizes[i].name.indexOf(this.options.artSize, 0) < 0 ) {
                i++;
            }
            img = sizes[i]['#text'];
            imgTag($art, stripslashes(img), data.images['@attr'].artist);

        // 画像が見つからなければこっち
        } catch (e) {
            imgTag($art, this.options.noart);
        }
    }

    // エラーが起こったらここに来る
    ,handleError: function(data) {
        this.$container.children().remove();
        var $item = $(this.item).prependTo(this.$container);
        $('.lfm_song',   $item).text('error: '   + data.error);
        $('.lfm_artist', $item).text('message: ' + data.message);
    }
};

// '10m'のような時間を表す文字列を解析する
function parseNum(i) {
    i = i + '';
    return (
        i.match(/(\d+)h$/i) ? RegExp.$1 * 3600 :
        i.match(/(\d+)m$/i) ? RegExp.$1 * 60   :
        i.match(/(\d+)s$/i) ? RegExp.$1 * 1    :
        i.match(/(\d+)/)    ? RegExp.$1 * 1    : 600
    );
}

// 様々な時刻を返す
function setEpoch(num) {
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
}

// バックスラッシュを除く
function stripslashes(str) {
    return (str + '')
        .replace(/\0/g, '0')
        .replace(/\\([\\'"])/g, '$1');
}

// <img>タグを挿入する
function imgTag($item, url, alt) {
    $('<img/>')
        .attr({
            src: url
            ,alt: alt ? alt : null
        })
        .appendTo($item)
    ;
}

// prototype.js's bind() in jQuery
// http://16c.jp/2008/0528214632.php
function scope(f, t) {
    return function(){
        return f.apply(t, arguments);
    };
}

// JavaScript currying
// http://nanto.asablo.jp/blog/2008/02/14/2626240
function curry(f, t) {
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
}


// メソッドを登録する
$.fn.lastFM = function(options) {
    $(this).each(function() {
        new LFM(options, this);
    });
};


})(jQuery);

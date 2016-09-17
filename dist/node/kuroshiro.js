/*!
 * kuroshiro.js
 * Copyright(c) 2015 Hexen Qi <hexenq@gmail.com>
 * MIT Licensed
 */

"use strict";

var kuromoji = require('kuromoji');
var wanakana = require('wanakana');

var tokenizer = null;

// check where we are, node or browser
var isNode = false;
var isBrowser = (typeof window !== 'undefined');
if(!isBrowser && typeof module !== 'undefined' && module.exports){
    isNode = true;
}

/**
 * Check if given char is a kanji
 *
 * @param {string} ch Given char
 * @return {boolean} if given char is a kanji
 */
var isKanji = function(ch){
    ch = ch[0];
    return (ch >= '\u4e00' && ch <= '\u9fcf') ||
            (ch >= '\uf900' && ch <= '\ufaff') ||
            (ch >= '\u3400' && ch <= '\u4dbf');
};

/**
 * Check if given string has hiragana
 *
 * @param {string} str Given string
 * @return {boolean} if given string has hiragana
 */
var hasHiragana = function(str){
    for(var i=0;i<str.length;i++){
        if(wanakana.isHiragana(str[i])) return true;
    }
    return false;
};

/**
 * Check if given string has katakana
 *
 * @param {string} str Given string
 * @return {boolean} if given string has katakana
 */
var hasKatakana = function(str){
    for(var i=0;i<str.length;i++){
        if(wanakana.isKatakana(str[i])) return true;
    }
    return false;
};

/**
 * Check if given string has kanji
 *
 * @param {string} str Given string
 * @return {boolean} if given string has kanji
 */
var hasKanji = function(str){
    for(var i=0;i<str.length;i++){
        if(isKanji(str[i])) return true;
    }
    return false;
};

var getStrType = function(str){ //0 for pure kanji,1 for kanji-hira(kana)-mixed,2 for pure hira(kana),3 for others
    var hasKJ = false;
    var hasHK = false;
    for(var i=0;i<str.length;i++){
        if(isKanji(str[i])) {
            hasKJ = true;
        }else if(wanakana.isHiragana(str[i]) || wanakana.isKatakana(str[i])) {
            hasHK = true;
        }
    }
    if(hasKJ && hasHK) return 1;
    else if(hasKJ) return 0;
    else if(hasHK) return 2;
    else return 3;
};

var splitObjArray = function(arr,prop,split){
    split = split || '';
    var result = '';
    for(var i=0;i<arr.length;i++){
        if(i!==arr.length-1){
            result += arr[i][prop] + '' + split;
        }else{
            result += arr[i][prop];
        }
    }
    return result;
};

/**
 * Convert given string to target syllabary with options available
 *
 * @param {string} str Given String
 * @param {Object} [options] JSON object which have key-value pairs settings
 * @param {string} [options.to='hiragana'] Target syllabary ['hiragana'|'katakana'|'romaji']
 * @param {string} [options.mode='normal'] Convert mode ['normal'|'spaced'|'okurigana'|'furigana']
 * @param {string} [options.delimiter_start='('] Delimiter(Start)
 * @param {string} [options.delimiter_end=')'] Delimiter(End)
 * TODO @param {boolean} [options.convertall=false] If convert all characters to target syllabary (by default only kanji will be converted)
 */
var convert = function(str, options){
    options = options || {};
    options.to = options.to || 'hiragana';
    options.mode = options.mode || 'normal';
    //options.convertall = options.convertall || false;
    options.delimiter_start = options.delimiter_start || '(';
    options.delimiter_end = options.delimiter_end || ')';
    str = str || '';

    var tokens = tokenizer.tokenize(str);
    for(var cr=0;cr<tokens.length;cr++){
        if(!tokens[cr].reading)
            tokens[cr].reading = tokens[cr].surface_form;
    }

    if(options.mode === 'normal' || options.mode === 'spaced'){
        switch (options.to){
            case 'katakana':
                if(options.mode === 'normal')
                    return splitObjArray(tokens,'reading');
                else
                    return splitObjArray(tokens,'reading',' ');
                break;
            case 'romaji':
                if(options.mode === 'normal')
                    return wanakana.toRomaji(splitObjArray(tokens, 'reading'));
                else
                    return wanakana.toRomaji(splitObjArray(tokens, 'reading', ' '));
                break;
            case 'hiragana':
                for(var hi=0;hi<tokens.length;hi++){
                    if(!hasKatakana(tokens[hi].surface_form) && hasKanji(tokens[hi].surface_form)){
                        tokens[hi].reading = wanakana.toHiragana(tokens[hi].reading);
                    }else{
                        tokens[hi].reading = tokens[hi].surface_form;
                    }
                }
                if(options.mode === 'normal')
                    return splitObjArray(tokens,'reading');
                else
                    return splitObjArray(tokens,'reading',' ');
                break;
        }
    }else if(options.mode === 'okurigana' || options.mode === 'furigana'){
        var notations = []; //[basic,basic_type[1=kanji,2=hiragana(katakana),3=others],notation]
        for(var i=0;i<tokens.length;i++){
            tokens[i].reading = wanakana.toHiragana(tokens[i].reading);

            var strType = getStrType(tokens[i].surface_form);
            switch (strType){
                case 0:
                    notations.push([tokens[i].surface_form,1,tokens[i].reading]);
                    break;
                case 1:
                    var pattern = '';
                    for(var c=0;c<tokens[i].surface_form.length;c++){
                        if(isKanji(tokens[i].surface_form[c])){
                            pattern += '(.*)';
                        }else{
                            pattern += tokens[i].surface_form[c];
                        }
                    }
                    var reg = new RegExp(pattern);
                    var matches = reg.exec(tokens[i].reading);
                    var pickKanji = 0;
                    for(var c1=0;c1<tokens[i].surface_form.length;c1++){
                        if(isKanji(tokens[i].surface_form[c1])){
                            notations.push([tokens[i].surface_form[c1],1,matches[pickKanji+1]]);
                            pickKanji++;
                        }else{
                            notations.push([tokens[i].surface_form[c1],2,wanakana.toHiragana(tokens[i].surface_form[c1])]);
                        }
                    }
                    break;
                case 2:
                    for(var c2=0;c2<tokens[i].surface_form.length;c2++){
                        notations.push([tokens[i].surface_form[c2],2,tokens[i].reading[c2]]);
                    }
                    break;
                case 3:
                    for(var c3=0;c3<tokens[i].surface_form.length;c3++){
                        notations.push([tokens[i].surface_form[c3],3,tokens[i].surface_form[c3]]);
                    }
                    break;
            }
        }
        var result = '';
        switch (options.to){
            case 'katakana':
                if(options.mode === 'okurigana'){
                    for(var n0=0;n0<notations.length;n0++){
                        if(notations[n0][1]!==1){
                            result += notations[n0][0];
                        }else{
                            result += notations[n0][0] + options.delimiter_start + wanakana.toKatakana(notations[n0][2]) + options.delimiter_end;
                        }
                    }
                }else{ //furigana
                    for(var n1=0;n1<notations.length;n1++){
                        if(notations[n1][1]!==1){
                            result += notations[n1][0];
                        }else{
                            result += "<ruby>" + notations[n1][0] + "<rp>" + options.delimiter_start + "</rp><rt>" + wanakana.toKatakana(notations[n1][2]) + "</rt><rp>" + options.delimiter_end + "</rp></ruby>";
                        }
                    }
                }
                return result;
            case 'romaji':
                if(options.mode === 'okurigana')
                    for(var n2=0;n2<notations.length;n2++){
                        if(notations[n2][1]!==1){
                            result += notations[n2][0];
                        }else{
                            result += notations[n2][0] + options.delimiter_start + wanakana.toRomaji(notations[n2][2]) + options.delimiter_end;
                        }
                    }
                else{ //furigana
                    result += "<ruby>";
                    for(var n3=0;n3<notations.length;n3++){
                        result += notations[n3][0] + "<rp>" + options.delimiter_start + "</rp><rt>" + wanakana.toRomaji(notations[n3][2]) + "</rt><rp>" + options.delimiter_end + "</rp>";
                    }
                    result += "</ruby>";
                }
                return result;
            case 'hiragana':
                if(options.mode === 'okurigana'){
                    for(var n4=0;n4<notations.length;n4++){
                        if(notations[n4][1]!==1){
                            result += notations[n4][0];
                        }else{
                            result += notations[n4][0] + options.delimiter_start + notations[n4][2] + options.delimiter_end;
                        }
                    }
                }else{ //furigana
                    for(var n5=0;n5<notations.length;n5++){
                        if(notations[n5][1]!==1){
                            result += notations[n5][0];
                        }else{
                            result += "<ruby>" + notations[n5][0] + "<rp>" + options.delimiter_start + "</rp><rt>" + notations[n5][2] + "</rt><rp>" + options.delimiter_end + "</rp></ruby>";
                        }
                    }
                }
                return result;
        }
    }else{
        throw new Error('No such mode...');
    }

};

/**
 * Convert given string to hiragana with options available
 *
 * @param {string} str Given String
 * @param {Object} [options] JSON object which have key-value pairs settings
 * @param {string} [options.mode='normal'] Convert mode ['normal'|'spaced'|'okurigana'|'furigana']
 * @param {string} [options.delimiter_start='('] Delimiter(Start)
 * @param {string} [options.delimiter_end=')'] Delimiter(End)
 */
var toHiragana = function(str, options){
    options = options || {};
    options.to = 'hiragana';
    return convert(str,options);
};

/**
 * Convert given string to katakana with options available
 *
 * @param {string} str Given String
 * @param {Object} [options] JSON object which have key-value pairs settings
 * @param {string} [options.mode='normal'] Convert mode ['normal'|'spaced'|'okurigana'|'furigana']
 * @param {string} [options.delimiter_start='('] Delimiter(Start)
 * @param {string} [options.delimiter_end=')'] Delimiter(End)
 */
var toKatakana = function(str, options){
    options = options || {};
    options.to = 'katakana';
    return convert(str,options);
};

/**
 * Convert given string to romaji with options available
 *
 * @param {string} str Given String
 * @param {Object} [options] JSON object which have key-value pairs settings
 * @param {string} [options.mode='normal'] Convert mode ['normal'|'spaced'|'okurigana'|'furigana']
 * @param {string} [options.delimiter_start='('] Delimiter(Start)
 * @param {string} [options.delimiter_end=')'] Delimiter(End)
 */
var toRomaji = function(str, options){
    options = options || {};
    options.to = 'romaji';
    return convert(str,options);
};

/**
 * Initiate kuroshiro.js
 *
 * @param {Object} options Options [dicPath]
 * @param {function} [callback] Callback after building kuromoji tokenizer
 */
var init = function(options, callback){
    if(typeof options === 'function'){
        callback = options;
        options = {};
    }else{
        options = options || {};
    }

    var dicPath = options.dicPath;
    if(!dicPath){
        if(isNode) dicPath = require.resolve('kuromoji').replace(/src.*/,'dict/');
        else dicPath = 'bower_components/kuroshiro/dist/dict/';
    }
    kuromoji.builder({ dicPath: dicPath }).build(function (err, newtokenizer) {
        if(err)
            return callback(err);

        tokenizer = newtokenizer;
        kuroshiro.tokenize = tokenizer.tokenize;
        callback();
    });
};

var kuroshiro = {
    init: init,
    isHiragana: wanakana.isHiragana,
    isKatakana: wanakana.isKatakana,
    isRomaji: wanakana.isRomaji,
    isKanji: isKanji,
    hasHiragana: hasHiragana,
    hasKatakana: hasKatakana,
    hasKanji: hasKanji,
    convert: convert,
    toHiragana: toHiragana,
    toKatakana: toKatakana,
    toRomaji: toRomaji,
    toKana: wanakana.toKana
};

module.exports = kuroshiro;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJrdXJvc2hpcm8uanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyohXG4gKiBrdXJvc2hpcm8uanNcbiAqIENvcHlyaWdodChjKSAyMDE1IEhleGVuIFFpIDxoZXhlbnFAZ21haWwuY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBrdXJvbW9qaSA9IHJlcXVpcmUoJ2t1cm9tb2ppJyk7XG52YXIgd2FuYWthbmEgPSByZXF1aXJlKCd3YW5ha2FuYScpO1xuXG52YXIgdG9rZW5pemVyID0gbnVsbDtcblxuLy8gY2hlY2sgd2hlcmUgd2UgYXJlLCBub2RlIG9yIGJyb3dzZXJcbnZhciBpc05vZGUgPSBmYWxzZTtcbnZhciBpc0Jyb3dzZXIgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpO1xuaWYoIWlzQnJvd3NlciAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cyl7XG4gICAgaXNOb2RlID0gdHJ1ZTtcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBnaXZlbiBjaGFyIGlzIGEga2FuamlcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gY2ggR2l2ZW4gY2hhclxuICogQHJldHVybiB7Ym9vbGVhbn0gaWYgZ2l2ZW4gY2hhciBpcyBhIGthbmppXG4gKi9cbnZhciBpc0thbmppID0gZnVuY3Rpb24oY2gpe1xuICAgIGNoID0gY2hbMF07XG4gICAgcmV0dXJuIChjaCA+PSAnXFx1NGUwMCcgJiYgY2ggPD0gJ1xcdTlmY2YnKSB8fFxuICAgICAgICAgICAgKGNoID49ICdcXHVmOTAwJyAmJiBjaCA8PSAnXFx1ZmFmZicpIHx8XG4gICAgICAgICAgICAoY2ggPj0gJ1xcdTM0MDAnICYmIGNoIDw9ICdcXHU0ZGJmJyk7XG59O1xuXG4vKipcbiAqIENoZWNrIGlmIGdpdmVuIHN0cmluZyBoYXMgaGlyYWdhbmFcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIEdpdmVuIHN0cmluZ1xuICogQHJldHVybiB7Ym9vbGVhbn0gaWYgZ2l2ZW4gc3RyaW5nIGhhcyBoaXJhZ2FuYVxuICovXG52YXIgaGFzSGlyYWdhbmEgPSBmdW5jdGlvbihzdHIpe1xuICAgIGZvcih2YXIgaT0wO2k8c3RyLmxlbmd0aDtpKyspe1xuICAgICAgICBpZih3YW5ha2FuYS5pc0hpcmFnYW5hKHN0cltpXSkpIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG4vKipcbiAqIENoZWNrIGlmIGdpdmVuIHN0cmluZyBoYXMga2F0YWthbmFcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIEdpdmVuIHN0cmluZ1xuICogQHJldHVybiB7Ym9vbGVhbn0gaWYgZ2l2ZW4gc3RyaW5nIGhhcyBrYXRha2FuYVxuICovXG52YXIgaGFzS2F0YWthbmEgPSBmdW5jdGlvbihzdHIpe1xuICAgIGZvcih2YXIgaT0wO2k8c3RyLmxlbmd0aDtpKyspe1xuICAgICAgICBpZih3YW5ha2FuYS5pc0thdGFrYW5hKHN0cltpXSkpIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG4vKipcbiAqIENoZWNrIGlmIGdpdmVuIHN0cmluZyBoYXMga2FuamlcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIEdpdmVuIHN0cmluZ1xuICogQHJldHVybiB7Ym9vbGVhbn0gaWYgZ2l2ZW4gc3RyaW5nIGhhcyBrYW5qaVxuICovXG52YXIgaGFzS2FuamkgPSBmdW5jdGlvbihzdHIpe1xuICAgIGZvcih2YXIgaT0wO2k8c3RyLmxlbmd0aDtpKyspe1xuICAgICAgICBpZihpc0thbmppKHN0cltpXSkpIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG52YXIgZ2V0U3RyVHlwZSA9IGZ1bmN0aW9uKHN0cil7IC8vMCBmb3IgcHVyZSBrYW5qaSwxIGZvciBrYW5qaS1oaXJhKGthbmEpLW1peGVkLDIgZm9yIHB1cmUgaGlyYShrYW5hKSwzIGZvciBvdGhlcnNcbiAgICB2YXIgaGFzS0ogPSBmYWxzZTtcbiAgICB2YXIgaGFzSEsgPSBmYWxzZTtcbiAgICBmb3IodmFyIGk9MDtpPHN0ci5sZW5ndGg7aSsrKXtcbiAgICAgICAgaWYoaXNLYW5qaShzdHJbaV0pKSB7XG4gICAgICAgICAgICBoYXNLSiA9IHRydWU7XG4gICAgICAgIH1lbHNlIGlmKHdhbmFrYW5hLmlzSGlyYWdhbmEoc3RyW2ldKSB8fCB3YW5ha2FuYS5pc0thdGFrYW5hKHN0cltpXSkpIHtcbiAgICAgICAgICAgIGhhc0hLID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZihoYXNLSiAmJiBoYXNISykgcmV0dXJuIDE7XG4gICAgZWxzZSBpZihoYXNLSikgcmV0dXJuIDA7XG4gICAgZWxzZSBpZihoYXNISykgcmV0dXJuIDI7XG4gICAgZWxzZSByZXR1cm4gMztcbn07XG5cbnZhciBzcGxpdE9iakFycmF5ID0gZnVuY3Rpb24oYXJyLHByb3Asc3BsaXQpe1xuICAgIHNwbGl0ID0gc3BsaXQgfHwgJyc7XG4gICAgdmFyIHJlc3VsdCA9ICcnO1xuICAgIGZvcih2YXIgaT0wO2k8YXJyLmxlbmd0aDtpKyspe1xuICAgICAgICBpZihpIT09YXJyLmxlbmd0aC0xKXtcbiAgICAgICAgICAgIHJlc3VsdCArPSBhcnJbaV1bcHJvcF0gKyAnJyArIHNwbGl0O1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHJlc3VsdCArPSBhcnJbaV1bcHJvcF07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8qKlxuICogQ29udmVydCBnaXZlbiBzdHJpbmcgdG8gdGFyZ2V0IHN5bGxhYmFyeSB3aXRoIG9wdGlvbnMgYXZhaWxhYmxlXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHN0ciBHaXZlbiBTdHJpbmdcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gSlNPTiBvYmplY3Qgd2hpY2ggaGF2ZSBrZXktdmFsdWUgcGFpcnMgc2V0dGluZ3NcbiAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy50bz0naGlyYWdhbmEnXSBUYXJnZXQgc3lsbGFiYXJ5IFsnaGlyYWdhbmEnfCdrYXRha2FuYSd8J3JvbWFqaSddXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMubW9kZT0nbm9ybWFsJ10gQ29udmVydCBtb2RlIFsnbm9ybWFsJ3wnc3BhY2VkJ3wnb2t1cmlnYW5hJ3wnZnVyaWdhbmEnXVxuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmRlbGltaXRlcl9zdGFydD0nKCddIERlbGltaXRlcihTdGFydClcbiAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5kZWxpbWl0ZXJfZW5kPScpJ10gRGVsaW1pdGVyKEVuZClcbiAqIFRPRE8gQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jb252ZXJ0YWxsPWZhbHNlXSBJZiBjb252ZXJ0IGFsbCBjaGFyYWN0ZXJzIHRvIHRhcmdldCBzeWxsYWJhcnkgKGJ5IGRlZmF1bHQgb25seSBrYW5qaSB3aWxsIGJlIGNvbnZlcnRlZClcbiAqL1xudmFyIGNvbnZlcnQgPSBmdW5jdGlvbihzdHIsIG9wdGlvbnMpe1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIG9wdGlvbnMudG8gPSBvcHRpb25zLnRvIHx8ICdoaXJhZ2FuYSc7XG4gICAgb3B0aW9ucy5tb2RlID0gb3B0aW9ucy5tb2RlIHx8ICdub3JtYWwnO1xuICAgIC8vb3B0aW9ucy5jb252ZXJ0YWxsID0gb3B0aW9ucy5jb252ZXJ0YWxsIHx8IGZhbHNlO1xuICAgIG9wdGlvbnMuZGVsaW1pdGVyX3N0YXJ0ID0gb3B0aW9ucy5kZWxpbWl0ZXJfc3RhcnQgfHwgJygnO1xuICAgIG9wdGlvbnMuZGVsaW1pdGVyX2VuZCA9IG9wdGlvbnMuZGVsaW1pdGVyX2VuZCB8fCAnKSc7XG4gICAgc3RyID0gc3RyIHx8ICcnO1xuXG4gICAgdmFyIHRva2VucyA9IHRva2VuaXplci50b2tlbml6ZShzdHIpO1xuICAgIGZvcih2YXIgY3I9MDtjcjx0b2tlbnMubGVuZ3RoO2NyKyspe1xuICAgICAgICBpZighdG9rZW5zW2NyXS5yZWFkaW5nKVxuICAgICAgICAgICAgdG9rZW5zW2NyXS5yZWFkaW5nID0gdG9rZW5zW2NyXS5zdXJmYWNlX2Zvcm07XG4gICAgfVxuXG4gICAgaWYob3B0aW9ucy5tb2RlID09PSAnbm9ybWFsJyB8fCBvcHRpb25zLm1vZGUgPT09ICdzcGFjZWQnKXtcbiAgICAgICAgc3dpdGNoIChvcHRpb25zLnRvKXtcbiAgICAgICAgICAgIGNhc2UgJ2thdGFrYW5hJzpcbiAgICAgICAgICAgICAgICBpZihvcHRpb25zLm1vZGUgPT09ICdub3JtYWwnKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3BsaXRPYmpBcnJheSh0b2tlbnMsJ3JlYWRpbmcnKTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzcGxpdE9iakFycmF5KHRva2VucywncmVhZGluZycsJyAnKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3JvbWFqaSc6XG4gICAgICAgICAgICAgICAgaWYob3B0aW9ucy5tb2RlID09PSAnbm9ybWFsJylcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHdhbmFrYW5hLnRvUm9tYWppKHNwbGl0T2JqQXJyYXkodG9rZW5zLCAncmVhZGluZycpKTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB3YW5ha2FuYS50b1JvbWFqaShzcGxpdE9iakFycmF5KHRva2VucywgJ3JlYWRpbmcnLCAnICcpKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2hpcmFnYW5hJzpcbiAgICAgICAgICAgICAgICBmb3IodmFyIGhpPTA7aGk8dG9rZW5zLmxlbmd0aDtoaSsrKXtcbiAgICAgICAgICAgICAgICAgICAgaWYoIWhhc0thdGFrYW5hKHRva2Vuc1toaV0uc3VyZmFjZV9mb3JtKSAmJiBoYXNLYW5qaSh0b2tlbnNbaGldLnN1cmZhY2VfZm9ybSkpe1xuICAgICAgICAgICAgICAgICAgICAgICAgdG9rZW5zW2hpXS5yZWFkaW5nID0gd2FuYWthbmEudG9IaXJhZ2FuYSh0b2tlbnNbaGldLnJlYWRpbmcpO1xuICAgICAgICAgICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRva2Vuc1toaV0ucmVhZGluZyA9IHRva2Vuc1toaV0uc3VyZmFjZV9mb3JtO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmKG9wdGlvbnMubW9kZSA9PT0gJ25vcm1hbCcpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzcGxpdE9iakFycmF5KHRva2VucywncmVhZGluZycpO1xuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNwbGl0T2JqQXJyYXkodG9rZW5zLCdyZWFkaW5nJywnICcpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfWVsc2UgaWYob3B0aW9ucy5tb2RlID09PSAnb2t1cmlnYW5hJyB8fCBvcHRpb25zLm1vZGUgPT09ICdmdXJpZ2FuYScpe1xuICAgICAgICB2YXIgbm90YXRpb25zID0gW107IC8vW2Jhc2ljLGJhc2ljX3R5cGVbMT1rYW5qaSwyPWhpcmFnYW5hKGthdGFrYW5hKSwzPW90aGVyc10sbm90YXRpb25dXG4gICAgICAgIGZvcih2YXIgaT0wO2k8dG9rZW5zLmxlbmd0aDtpKyspe1xuICAgICAgICAgICAgdG9rZW5zW2ldLnJlYWRpbmcgPSB3YW5ha2FuYS50b0hpcmFnYW5hKHRva2Vuc1tpXS5yZWFkaW5nKTtcblxuICAgICAgICAgICAgdmFyIHN0clR5cGUgPSBnZXRTdHJUeXBlKHRva2Vuc1tpXS5zdXJmYWNlX2Zvcm0pO1xuICAgICAgICAgICAgc3dpdGNoIChzdHJUeXBlKXtcbiAgICAgICAgICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICAgICAgICAgIG5vdGF0aW9ucy5wdXNoKFt0b2tlbnNbaV0uc3VyZmFjZV9mb3JtLDEsdG9rZW5zW2ldLnJlYWRpbmddKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgICAgICAgICB2YXIgcGF0dGVybiA9ICcnO1xuICAgICAgICAgICAgICAgICAgICBmb3IodmFyIGM9MDtjPHRva2Vuc1tpXS5zdXJmYWNlX2Zvcm0ubGVuZ3RoO2MrKyl7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihpc0thbmppKHRva2Vuc1tpXS5zdXJmYWNlX2Zvcm1bY10pKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuICs9ICcoLiopJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdHRlcm4gKz0gdG9rZW5zW2ldLnN1cmZhY2VfZm9ybVtjXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVnID0gbmV3IFJlZ0V4cChwYXR0ZXJuKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hdGNoZXMgPSByZWcuZXhlYyh0b2tlbnNbaV0ucmVhZGluZyk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwaWNrS2FuamkgPSAwO1xuICAgICAgICAgICAgICAgICAgICBmb3IodmFyIGMxPTA7YzE8dG9rZW5zW2ldLnN1cmZhY2VfZm9ybS5sZW5ndGg7YzErKyl7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihpc0thbmppKHRva2Vuc1tpXS5zdXJmYWNlX2Zvcm1bYzFdKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm90YXRpb25zLnB1c2goW3Rva2Vuc1tpXS5zdXJmYWNlX2Zvcm1bYzFdLDEsbWF0Y2hlc1twaWNrS2FuamkrMV1dKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwaWNrS2FuamkrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vdGF0aW9ucy5wdXNoKFt0b2tlbnNbaV0uc3VyZmFjZV9mb3JtW2MxXSwyLHdhbmFrYW5hLnRvSGlyYWdhbmEodG9rZW5zW2ldLnN1cmZhY2VfZm9ybVtjMV0pXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgICAgICAgICBmb3IodmFyIGMyPTA7YzI8dG9rZW5zW2ldLnN1cmZhY2VfZm9ybS5sZW5ndGg7YzIrKyl7XG4gICAgICAgICAgICAgICAgICAgICAgICBub3RhdGlvbnMucHVzaChbdG9rZW5zW2ldLnN1cmZhY2VfZm9ybVtjMl0sMix0b2tlbnNbaV0ucmVhZGluZ1tjMl1dKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICAgICAgICAgIGZvcih2YXIgYzM9MDtjMzx0b2tlbnNbaV0uc3VyZmFjZV9mb3JtLmxlbmd0aDtjMysrKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vdGF0aW9ucy5wdXNoKFt0b2tlbnNbaV0uc3VyZmFjZV9mb3JtW2MzXSwzLHRva2Vuc1tpXS5zdXJmYWNlX2Zvcm1bYzNdXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJlc3VsdCA9ICcnO1xuICAgICAgICBzd2l0Y2ggKG9wdGlvbnMudG8pe1xuICAgICAgICAgICAgY2FzZSAna2F0YWthbmEnOlxuICAgICAgICAgICAgICAgIGlmKG9wdGlvbnMubW9kZSA9PT0gJ29rdXJpZ2FuYScpe1xuICAgICAgICAgICAgICAgICAgICBmb3IodmFyIG4wPTA7bjA8bm90YXRpb25zLmxlbmd0aDtuMCsrKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKG5vdGF0aW9uc1tuMF1bMV0hPT0xKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gbm90YXRpb25zW24wXVswXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCArPSBub3RhdGlvbnNbbjBdWzBdICsgb3B0aW9ucy5kZWxpbWl0ZXJfc3RhcnQgKyB3YW5ha2FuYS50b0thdGFrYW5hKG5vdGF0aW9uc1tuMF1bMl0pICsgb3B0aW9ucy5kZWxpbWl0ZXJfZW5kO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfWVsc2V7IC8vZnVyaWdhbmFcbiAgICAgICAgICAgICAgICAgICAgZm9yKHZhciBuMT0wO24xPG5vdGF0aW9ucy5sZW5ndGg7bjErKyl7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihub3RhdGlvbnNbbjFdWzFdIT09MSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ICs9IG5vdGF0aW9uc1tuMV1bMF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gXCI8cnVieT5cIiArIG5vdGF0aW9uc1tuMV1bMF0gKyBcIjxycD5cIiArIG9wdGlvbnMuZGVsaW1pdGVyX3N0YXJ0ICsgXCI8L3JwPjxydD5cIiArIHdhbmFrYW5hLnRvS2F0YWthbmEobm90YXRpb25zW24xXVsyXSkgKyBcIjwvcnQ+PHJwPlwiICsgb3B0aW9ucy5kZWxpbWl0ZXJfZW5kICsgXCI8L3JwPjwvcnVieT5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgY2FzZSAncm9tYWppJzpcbiAgICAgICAgICAgICAgICBpZihvcHRpb25zLm1vZGUgPT09ICdva3VyaWdhbmEnKVxuICAgICAgICAgICAgICAgICAgICBmb3IodmFyIG4yPTA7bjI8bm90YXRpb25zLmxlbmd0aDtuMisrKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKG5vdGF0aW9uc1tuMl1bMV0hPT0xKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gbm90YXRpb25zW24yXVswXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCArPSBub3RhdGlvbnNbbjJdWzBdICsgb3B0aW9ucy5kZWxpbWl0ZXJfc3RhcnQgKyB3YW5ha2FuYS50b1JvbWFqaShub3RhdGlvbnNbbjJdWzJdKSArIG9wdGlvbnMuZGVsaW1pdGVyX2VuZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2V7IC8vZnVyaWdhbmFcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ICs9IFwiPHJ1Ynk+XCI7XG4gICAgICAgICAgICAgICAgICAgIGZvcih2YXIgbjM9MDtuMzxub3RhdGlvbnMubGVuZ3RoO24zKyspe1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ICs9IG5vdGF0aW9uc1tuM11bMF0gKyBcIjxycD5cIiArIG9wdGlvbnMuZGVsaW1pdGVyX3N0YXJ0ICsgXCI8L3JwPjxydD5cIiArIHdhbmFrYW5hLnRvUm9tYWppKG5vdGF0aW9uc1tuM11bMl0pICsgXCI8L3J0PjxycD5cIiArIG9wdGlvbnMuZGVsaW1pdGVyX2VuZCArIFwiPC9ycD5cIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gXCI8L3J1Ynk+XCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICBjYXNlICdoaXJhZ2FuYSc6XG4gICAgICAgICAgICAgICAgaWYob3B0aW9ucy5tb2RlID09PSAnb2t1cmlnYW5hJyl7XG4gICAgICAgICAgICAgICAgICAgIGZvcih2YXIgbjQ9MDtuNDxub3RhdGlvbnMubGVuZ3RoO240Kyspe1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYobm90YXRpb25zW240XVsxXSE9PTEpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCArPSBub3RhdGlvbnNbbjRdWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ICs9IG5vdGF0aW9uc1tuNF1bMF0gKyBvcHRpb25zLmRlbGltaXRlcl9zdGFydCArIG5vdGF0aW9uc1tuNF1bMl0gKyBvcHRpb25zLmRlbGltaXRlcl9lbmQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9ZWxzZXsgLy9mdXJpZ2FuYVxuICAgICAgICAgICAgICAgICAgICBmb3IodmFyIG41PTA7bjU8bm90YXRpb25zLmxlbmd0aDtuNSsrKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKG5vdGF0aW9uc1tuNV1bMV0hPT0xKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gbm90YXRpb25zW241XVswXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCArPSBcIjxydWJ5PlwiICsgbm90YXRpb25zW241XVswXSArIFwiPHJwPlwiICsgb3B0aW9ucy5kZWxpbWl0ZXJfc3RhcnQgKyBcIjwvcnA+PHJ0PlwiICsgbm90YXRpb25zW241XVsyXSArIFwiPC9ydD48cnA+XCIgKyBvcHRpb25zLmRlbGltaXRlcl9lbmQgKyBcIjwvcnA+PC9ydWJ5PlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cbiAgICB9ZWxzZXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBzdWNoIG1vZGUuLi4nKTtcbiAgICB9XG5cbn07XG5cbi8qKlxuICogQ29udmVydCBnaXZlbiBzdHJpbmcgdG8gaGlyYWdhbmEgd2l0aCBvcHRpb25zIGF2YWlsYWJsZVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgR2l2ZW4gU3RyaW5nXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIEpTT04gb2JqZWN0IHdoaWNoIGhhdmUga2V5LXZhbHVlIHBhaXJzIHNldHRpbmdzXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMubW9kZT0nbm9ybWFsJ10gQ29udmVydCBtb2RlIFsnbm9ybWFsJ3wnc3BhY2VkJ3wnb2t1cmlnYW5hJ3wnZnVyaWdhbmEnXVxuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmRlbGltaXRlcl9zdGFydD0nKCddIERlbGltaXRlcihTdGFydClcbiAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5kZWxpbWl0ZXJfZW5kPScpJ10gRGVsaW1pdGVyKEVuZClcbiAqL1xudmFyIHRvSGlyYWdhbmEgPSBmdW5jdGlvbihzdHIsIG9wdGlvbnMpe1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIG9wdGlvbnMudG8gPSAnaGlyYWdhbmEnO1xuICAgIHJldHVybiBjb252ZXJ0KHN0cixvcHRpb25zKTtcbn07XG5cbi8qKlxuICogQ29udmVydCBnaXZlbiBzdHJpbmcgdG8ga2F0YWthbmEgd2l0aCBvcHRpb25zIGF2YWlsYWJsZVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgR2l2ZW4gU3RyaW5nXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIEpTT04gb2JqZWN0IHdoaWNoIGhhdmUga2V5LXZhbHVlIHBhaXJzIHNldHRpbmdzXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMubW9kZT0nbm9ybWFsJ10gQ29udmVydCBtb2RlIFsnbm9ybWFsJ3wnc3BhY2VkJ3wnb2t1cmlnYW5hJ3wnZnVyaWdhbmEnXVxuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmRlbGltaXRlcl9zdGFydD0nKCddIERlbGltaXRlcihTdGFydClcbiAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5kZWxpbWl0ZXJfZW5kPScpJ10gRGVsaW1pdGVyKEVuZClcbiAqL1xudmFyIHRvS2F0YWthbmEgPSBmdW5jdGlvbihzdHIsIG9wdGlvbnMpe1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIG9wdGlvbnMudG8gPSAna2F0YWthbmEnO1xuICAgIHJldHVybiBjb252ZXJ0KHN0cixvcHRpb25zKTtcbn07XG5cbi8qKlxuICogQ29udmVydCBnaXZlbiBzdHJpbmcgdG8gcm9tYWppIHdpdGggb3B0aW9ucyBhdmFpbGFibGVcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIEdpdmVuIFN0cmluZ1xuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBKU09OIG9iamVjdCB3aGljaCBoYXZlIGtleS12YWx1ZSBwYWlycyBzZXR0aW5nc1xuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLm1vZGU9J25vcm1hbCddIENvbnZlcnQgbW9kZSBbJ25vcm1hbCd8J3NwYWNlZCd8J29rdXJpZ2FuYSd8J2Z1cmlnYW5hJ11cbiAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5kZWxpbWl0ZXJfc3RhcnQ9JygnXSBEZWxpbWl0ZXIoU3RhcnQpXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZGVsaW1pdGVyX2VuZD0nKSddIERlbGltaXRlcihFbmQpXG4gKi9cbnZhciB0b1JvbWFqaSA9IGZ1bmN0aW9uKHN0ciwgb3B0aW9ucyl7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgb3B0aW9ucy50byA9ICdyb21hamknO1xuICAgIHJldHVybiBjb252ZXJ0KHN0cixvcHRpb25zKTtcbn07XG5cbi8qKlxuICogSW5pdGlhdGUga3Vyb3NoaXJvLmpzXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgT3B0aW9ucyBbZGljUGF0aF1cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IFtjYWxsYmFja10gQ2FsbGJhY2sgYWZ0ZXIgYnVpbGRpbmcga3Vyb21vamkgdG9rZW5pemVyXG4gKi9cbnZhciBpbml0ID0gZnVuY3Rpb24ob3B0aW9ucywgY2FsbGJhY2spe1xuICAgIGlmKHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKXtcbiAgICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgICAgICBvcHRpb25zID0ge307XG4gICAgfWVsc2V7XG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIH1cblxuICAgIHZhciBkaWNQYXRoID0gb3B0aW9ucy5kaWNQYXRoO1xuICAgIGlmKCFkaWNQYXRoKXtcbiAgICAgICAgaWYoaXNOb2RlKSBkaWNQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCdrdXJvbW9qaScpLnJlcGxhY2UoL3NyYy4qLywnZGljdC8nKTtcbiAgICAgICAgZWxzZSBkaWNQYXRoID0gJ2Jvd2VyX2NvbXBvbmVudHMva3Vyb3NoaXJvL2Rpc3QvZGljdC8nO1xuICAgIH1cbiAgICBrdXJvbW9qaS5idWlsZGVyKHsgZGljUGF0aDogZGljUGF0aCB9KS5idWlsZChmdW5jdGlvbiAoZXJyLCBuZXd0b2tlbml6ZXIpIHtcbiAgICAgICAgaWYoZXJyKVxuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG5cbiAgICAgICAgdG9rZW5pemVyID0gbmV3dG9rZW5pemVyO1xuICAgICAgICBrdXJvc2hpcm8udG9rZW5pemUgPSB0b2tlbml6ZXIudG9rZW5pemU7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgfSk7XG59O1xuXG52YXIga3Vyb3NoaXJvID0ge1xuICAgIGluaXQ6IGluaXQsXG4gICAgaXNIaXJhZ2FuYTogd2FuYWthbmEuaXNIaXJhZ2FuYSxcbiAgICBpc0thdGFrYW5hOiB3YW5ha2FuYS5pc0thdGFrYW5hLFxuICAgIGlzUm9tYWppOiB3YW5ha2FuYS5pc1JvbWFqaSxcbiAgICBpc0thbmppOiBpc0thbmppLFxuICAgIGhhc0hpcmFnYW5hOiBoYXNIaXJhZ2FuYSxcbiAgICBoYXNLYXRha2FuYTogaGFzS2F0YWthbmEsXG4gICAgaGFzS2Fuamk6IGhhc0thbmppLFxuICAgIGNvbnZlcnQ6IGNvbnZlcnQsXG4gICAgdG9IaXJhZ2FuYTogdG9IaXJhZ2FuYSxcbiAgICB0b0thdGFrYW5hOiB0b0thdGFrYW5hLFxuICAgIHRvUm9tYWppOiB0b1JvbWFqaSxcbiAgICB0b0thbmE6IHdhbmFrYW5hLnRvS2FuYVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBrdXJvc2hpcm87Il0sImZpbGUiOiJrdXJvc2hpcm8uanMiLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==

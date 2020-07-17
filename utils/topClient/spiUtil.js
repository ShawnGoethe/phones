const util = require('./topUtil.js');
const iconv = require('iconv-lite');
const URL = require('url');
const urlencode = require('urlencode');

const ipFileds = [ 'X-Real-IP', 'X-Forwarded-For', 'Proxy-Client-IP', 'WL-Proxy-Client-IP', 'HTTP_CLIENT_IP', 'HTTP_X_FORWARDED_FOR' ];

String.prototype.contains = function(target) {
	return this.indexOf(target) > -1;
};

/**
 * 校验SPI请求签名，不支持带上传文件的HTTP请求。
 *
 * @param bizParams 业务参数
 * @param httpHeaders http头部信息
 * @param secret APP密钥
 * @param charset 目标编码
 * @return boolean
 */
exports.checkSignForSpi = function checkSignForSpi(url, body, httpHeaders, secret) {
	let ctype = httpHeaders['content-type'];
	if (!ctype) {
		ctype = httpHeaders['Content-Type'];
	}
	if (!ctype) {
		return false;
	}

	const charset = this.getResponseCharset(ctype);
	const urlParams = URL.parse(url).query.split('&');
	const bizParams = buildBizParams(urlParams);
	return checkSignInternal(bizParams, body, httpHeaders, secret, charset);
};

function buildBizParams(urlParams) {
	const bizParams = {};
	for (let i = 0; i < urlParams.length; i++) {
		const params = urlParams[i].split('=');
		bizParams[params[0]] = params[1];
	}
	return bizParams;
}

/**
 * 检查发起SPI请求的来源IP是否是TOP机房的出口IP。
 *
 * @param request HTTP请求
 * @param topIpList TOP网关IP出口地址段列表，通过taobao.top.ipout.get获得
 *
 * @return boolean true表达IP来源合法，false代表IP来源不合法
 */
exports.checkRemoteIp = function checkRemoteIp(httpHeaders, topIpList) {
	let ip = null;
	for (var i = 0; i < ipFileds.length; i++) {
		const realIp = httpHeaders[ipFileds[i]];
		if (realIp && realIp.toLowerCase() != 'unknown') {
			ip = realIp;
			break;
		}
	}

	if (ip) {
		for (var i = 0; i < topIpList.length; i++) {
			if (ip == topIpList[i]) {
				return true;
			}
		}
	}
	return false;
};

/**
 * 检查SPI请求到达服务器端是否已经超过指定的分钟数，如果超过则拒绝请求。
 *
 * @return boolean true代表不超过，false代表超过。
 */
exports.checkTimestamp = function checkTimestamp(bizParams, minutes) {
	const timestamp = bizParams.timestamp;
	if (timestamp) {
		const remove = new Date(timestamp).getTime();
		const local = new Date().getTime();
		return (local - remove) <= minutes * 60 * 1000;
	}
	return false;
};

function arrayConcat(bizParams, signHttpParams) {
	if (signHttpParams) {
		for (let i = 0; i < signHttpParams.length; i++) {
			bizParams[signHttpParams[i].key] = signHttpParams[i].value;
		}
	}
}

function checkSignInternal(bizParams, body, httpHeaders, secret, charset) {
	const remoteSign = bizParams.sign;
	arrayConcat(bizParams, getHeaderMap(httpHeaders));
	const sorted = Object.keys(bizParams).sort();
	let bastString = secret;
	let localSign;
	for (let i = 0, l = sorted.length; i < l; i++) {
		let k = sorted[i];
		let value = bizParams[k];
		if (k == 'sign') {
			continue;
		}
		value = urlencode.decode(bizParams[k], charset);

		if (k == 'timestamp') {
			value = value.replace('+', ' ');
		}
		k = iconv.encode(k, charset);
		bastString += k;
		bastString += value;
	}
	if (body) {
		bastString += body;
	}

	bastString += secret;
	const buffer = iconv.encode(bastString, charset);
	localSign = util.md5(buffer).toUpperCase();
	return localSign == remoteSign;
}

function getHeaderMap(httpHeaders) {
	const resultMap = {};
	const signList = httpHeaders['top-sign-list'];
	if (signList) {
		const targetKeys = signList.split(',');
		targetKeys.forEach(function(target) {
			resultMap[target] = httpHeaders[target];
		});
	}
	return resultMap;
}

exports.getResponseCharset = function getResponseCharset(ctype) {
	let charset = 'UTF-8';
	if (ctype) {
		const params = ctype.split(';');
		for (let i = 0; i < params.length; i++) {
			const param = params[i].trim();
			if (param.startsWith('charset')) {
				const pair = param.split('=');
				charset = pair[1].trim().toUpperCase();
			}
		}
	}
	if (charset && charset.toLowerCase().startsWith('GB')) {
		charset = 'GBK';
	}
	return charset;
};

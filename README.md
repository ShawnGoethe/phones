<div align="center">
<h1>📱Phones</h1>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg"/>
  <img src="https://img.shields.io/static/v1?label=electron&message=7.1.7&color="/>
  <img src="https://img.shields.io/badge/language-javascript-yellow.svg?style=flat-square"/>
</div>


[ English | [中文](./README-CN.md) ]

## What I can do

- list Phone with its feature
- you can choose a suitable phone by filter
- Integrated recommend video,discount,link
- more products recommend not only phones (maybe)



## Environment

List main language and their versions，for more -->[package.json](./package.json)

```
- node v12.16.2
- eggjs v2.15.1
- egg-mysql: 3.0.0
- egg-sequelize: 5.2.2
- vue: 2.6.11
- vue-server-renderer: 2.6.11
- element-ui: 2.13.0
```



## Directory Structure

Use Eggjs

```
egg-project
├── package.json
├── app
|   ├── router.js
│   ├── controller
│   |   └── home.js
│   ├── service
│   ├── schedule
│   |   └── updatePrice.js
│   ├── public 
│   └── extend 
├── config
|   ├── plugin.js
|   ├── config.default.js
├── phones_phones.sql
```



## 🐼Todo List

:hand: add filter to select phones

:hand: add TaoBao schedule，to update price (at least 1 times/day)

:hand: add check function when create new phones

:hand: add more product to recommend ，such as dxo，earphone ,watch

:white_check_mark:  publish v0.1-welcome,and first images[2020-06-04@ShawnGoethe]

:white_check_mark:  have modify,delete function[2020-07-16@ShawnGoethe]

:white_check_mark:  input data，new search，add star recommend[2020-07-20@ShawnGoethe]



# 🚩Show

![](https://zehai-github.oss-cn-beijing.aliyuncs.com/index.jpg)



## 😄Welcome PR

wecome PR if I have

Main Language：Eggjs Sequelize VueSSR

> npm run dev //to start
>
> docker pull zhangzehai/phones:latest
>
> docker run -itd --name phones -p 7001:7001 zhangzehai/phones:latest
>
> Index-->localhost:7001/phone
>
> For more: visit router.js

## 🚩About me

- Blog：[http://zehai.info](http://zehai.info/)
- Github：http://github.com/ShawnGoethe
- Contact：569326840@qq.com

<div align="center">
<h1>Phone</h1>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg"/>
  <img src="https://img.shields.io/static/v1?label=electron&message=7.1.7&color="/>
  <img src="https://img.shields.io/static/v1?label=mac|win|linux&message=7.1.7&color=yellow"/>
</div>


## What I can do

- 列举主流销售手机产品，可以根据个人爱好，筛选手机种类
- 根据偏好，推荐手机
- 集成评测视频，购买链接，低价推荐
- 提供更多产品推荐，消费者发声

## Directory Structure

使用Eggjs完成开发架构

```
egg-project
├── package.json
├── app
|   ├── router.js//路由
│   ├── controller
│   |   └── home.js
│   ├── service
│   ├── schedule //定时爬取最新价格
│   |   └── updatePrice.js
│   ├── public //前段界面
│   └── extend 
├── config
|   ├── plugin.js//插件
|   ├── config.default.js//目前使用该环境
├── phones_phones.sql//数据库文件
```



## Todo List

:hand:新增筛选按钮，根据电池容量，通信几代来进行筛选

:hand:新增淘宝接口，实时更新价格（至少一天一次）

:hand:优化新增接口，新增校验功能

:hand:新增手机周边推荐，DXO，耳机推荐

:white_check_mark:服务搭建上线，image推送[2020-06-04@ShawnGoethe]

:white_check_mark:具备新增删除功能（删除暂时隐藏)[2020-07-16@ShawnGoethe]



## Welcome PR

项目处于新搭建状态，欢迎提交PR

主要技术：Eggjs Sequelize VueSSR

> npm run dev //to start
>
> docker pull zhangzehai/phones:latest
>
> docker run -itd --name phones -p 7001:7001 zhangzehai/phones:latest
>
> Index-->localhost:7001/phone
>
> For more: visit router.js

## About me

- 技术博客：[http://zehai.info](http://zehai.info/)
- Github：http://github.com/ShawnGoethe
- Contact：569326840@qq.com

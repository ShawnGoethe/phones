'use strict';
const Mongodb = require('mongodb');
const bcrypt = require('bcryptjs');
const { sendCertMsg } = require('../common/package');
const { processUpload } = require('../common/util');
const jsonwebtoken = require('jsonwebtoken'); // 生成 token
const uid = require('uid');
const moment = require('moment');
const { sendMsg, createOpsUser, generateImAccount, updateReservationTeacher, creatTrialAccount, createReservation, cancelReservation, changeReservation, sendFeedback } = require('../common/im');
const config = require('../config/index');

const Mutation = {
    // 修改学生课程包信息---当前接口已无用
    async updateStudentPackage(parent, args, { db }, info) {
        const { params } = args;

        /* 暂时没有使用事务，所以使用严格判断条件，防止出现更新课程包信息错误 */
        // 判断销售是否已经存在且在职
        const sale = await db.findOne('sales', { _id: Mongodb.ObjectID(params.saleId), isDimission: false });
        if (!sale) throw new Error('当前销售不存在或已经离职');

        // 判断新旧课程包信息是否已经存在
        const oldPackage = await db.findOne('packages', { _id: Mongodb.ObjectID(params.nowPackageId) });
        if (!oldPackage) throw new Error('旧课程信息不存在');
        const newPackage = await db.findOne('packages', { _id: Mongodb.ObjectID(params.beModifiedPackageId) });
        if (!newPackage) throw new Error('新课程信息不存在');

        // 判断当前销售是否存在wgroup
        const oldWgroupItem = await db.findOne('wgroups', { packageId: Mongodb.ObjectID(params.nowPackageId), salesId: Mongodb.ObjectID(params.saleId) });
        if (!oldWgroupItem) throw new Error('旧课程班级不存在');
        const newWgroupItem = await db.findOne('wgroups', { packageId: Mongodb.ObjectID(params.beModifiedPackageId), salesId: Mongodb.ObjectID(params.saleId) });
        if (!newWgroupItem) throw new Error('新课程班级不存在');

        // 判断订单信息是否存在
        const order = await db.findOne('regusers2', { Courseid: oldPackage.tag, Phone: params.mobile, Name_ZH: params.name });
        if (!order) throw new Error('订单信息不存在');


        // 第一步：将users表中原课程包替换为新课程包
        let userResult = await db.updateOne('users', { mobile: params.mobile }, { $pull: { packages: Mongodb.ObjectID(params.nowPackageId) } }, { returnOriginal: false });
        if (!userResult.ok || !userResult.value) throw new Error('删除课程信息失败');

        userResult = await db.updateOne('users', { mobile: params.mobile }, { $addToSet: { packages: Mongodb.ObjectID(params.beModifiedPackageId) } }, { returnOriginal: false });
        if (!userResult.ok || !userResult.value) throw new Error('增加课程信息失败');

        // 第二步：根据原课程包主键ID、所选销售主键ID及学生主键ID，查询wgroup表，如果存在，则将此学生从wgroup表中students数组中清除
        const oldWgroupResult = await db.updateOne('wgroups', { packageId: Mongodb.ObjectID(params.nowPackageId), salesId: Mongodb.ObjectID(params.saleId), students: Mongodb.ObjectID(params._id) }, { $pull: { students: Mongodb.ObjectID(params.saleId) } });
        if (!oldWgroupResult.ok || !oldWgroupResult.value) throw new Error('删除课程信息失败');

        // 第三步：根据新课程包主键ID、销售ID，查询wgroup表，如果存在，将学生主键ID插入到wgroup表中students数组中
        const nowWgroupResult = await db.updateOne('wgroups', { packageId: Mongodb.ObjectID(params.beModifiedPackageId), salesId: Mongodb.ObjectID(params.saleId) }, { $addToSet: { students: Mongodb.ObjectID(params._id) } });
        if (!nowWgroupResult.ok || !nowWgroupResult.value) throw new Error('增加wgroup记录信息失败');

        // 第四步： 根据原课程tag、学生手机号、学生姓名，查询regusers2表，如果存在，则将修改当前订单记录的 Class Courseid Classmanager Packagezh
        // 获取最新课程名从而修改Class名，待确定其它字段是否修改
        const orderResult = await db.updateOne('regusers2', { Courseid: oldPackage.tag, Phone: params.mobile, Name_ZH: params.name }, { $set: { Packagezh: newPackage.name.zh, Courseid: newPackage.tag, Classmanager: sale.name } });
        if (!orderResult.ok || !orderResult.value) throw new Error('更新订单信息失败');

        return userResult.value;
    },

    // 注册系统用户
    async createUser(parent, args, { db, systemAdminDb }, info) {
        let { mobile, name, isOn, qrCode, roleId, nickname } = args.params;
        const defaultPassword = 'geekstar';

        // 一个用户可以拥有多个角色
        roleId = roleId.map(id => {
            return Mongodb.ObjectID(id);
        });

        // 根据手机号判断用户是否存在
        let result = await systemAdminDb.findOne('system_users', { mobile });
        if (result) throw new Error('当前用户已存在，请更换手机号');

        // 生成密码
        const salt = await bcrypt.genSalt(10);
        const password = await bcrypt.hash(defaultPassword, salt);

        // 创建用户
        result = await systemAdminDb.insertOne('system_users', {
            name,
            mobile,
            password,
            nickname,
            // roleId: Mongodb.ObjectID(roleId),
            roleId,
            isOn,
            isReset: 1, // 去除重置密码这一步
            qrCode: qrCode ? qrCode : '',
            createTime: new Date(),
            updateTime: new Date(),
        });

        if (!result.ok) throw new Error('创建用户失败');

        return { success: true, msg: '创建用户成功' };
    },

    // 更新系统用户
    async updateUser(parent, args, { db, systemAdminDb, pay2Db }, info) {
        let { _id, mobile, name, isOn, roleId, qrCode, nickname } = args.params;

        // 一个用户可以拥有多个角色
        roleId = roleId.map(id => {
            return Mongodb.ObjectID(id);
        });

        // 根据手机号判断用户是否存在
        const userList = await systemAdminDb.find('system_users', { mobile });
        let isExists = false;
        for (const user of userList) {
            if (user._id != _id) {
                isExists = true;
                break;
            }
        }
        if (isExists) throw new Error('当前用户已存在，请更换手机号');

        // 更新用户
        const result = await systemAdminDb.updateOne('system_users', { _id: Mongodb.ObjectID(_id) }, { $set: { name, mobile, roleId, isOn, nickname, qrCode: (qrCode ? qrCode : ''), updateTime: new Date() } });
        if (!result.ok || !result.value) throw new Error('更新用户失败');

        /*
        如果更新手机号、姓名、二维码链接等信息时，需要处理以下步骤：
        1、更新partial信息
        2、更新订单信息---暂时不处理，因为已经是历史消息
        */
        if ((mobile != result.value.mobile) || (name != result.value.name) || (qrCode != result.value.qrCode)) {
            for (const id of roleId) {
                const roleItem = await systemAdminDb.findOne('system_roles', { _id: Mongodb.ObjectID(id) }, { projection: { tag: true, _id: true } });
                if (!roleItem || ((roleItem.tag != '一对多销售') && (roleItem.tag != '一对多班主任'))) continue;

                // 获取所有绑定禁用销售或班主任的partial课程
                const cursor = await db.getCursor('packages', { type: '_partial', 'contact._id': Mongodb.ObjectID(_id) });
                while (true) {
                    const partial = await cursor.next();
                    if (!partial) {
                        break;
                    }

                    // 更新partial中contact中联系人信息
                    const updatePartialItem = await db.updateOne('packages', { _id: Mongodb.ObjectID(partial._id) }, {
                        $set: {
                            'contact.name': name,
                            'contact.mobile': mobile,
                            'contact.qrCode': qrCode ? qrCode : '',
                        },
                    }, { returnOriginal: false });
                    if (!updatePartialItem.ok || !updatePartialItem.value) throw new Error('更新课程销售或班班主任联系人信息失败');
                }
            }
        }

        /*
        如果是禁用用户，针对一对多销售与班主任角色，需要处理以下步骤：
        1、将产品中销售或班主任信息移除，并且同时填加一个同名角色的销售进去
        2、更新partial信息
        3、更新订单信息---暂时不处理，因为已经是历史消息
        */
        if (isOn === 2) {
            // 判断当前角色是否是销售或班主任角色，如果是，则清空产品中名单且将之前历史账号的学生的package联系人信息替换成一个同名角色的人
            for (const id of roleId) {
                const roleItem = await systemAdminDb.findOne('system_roles', { _id: Mongodb.ObjectID(id) }, { projection: { tag: true, _id: true } });
                if (!roleItem || ((roleItem.tag != '一对多销售') && (roleItem.tag != '一对多班主任'))) continue;

                // 找到对应角色的一个人去填充销售或班主任名单，防止销售或班主任列表为空
                const userItem = await systemAdminDb.findOne('system_users', { roleId: Mongodb.ObjectID(id), isOn: 1, isReset: 1 });
                if (!userItem) throw new Error('当前一对多销售角色或一对多班主任角色对应人员列表为空');

                if (roleItem.tag === '一对多销售') {
                    // 如果是一对多销售，那先清空对应产品中禁用一对多销售名单并且同时填加一个同名角色的一对多销售人员，尽量保证一对多产品中一对多销售列表永远不为空，但是不能保证一对多销售角色对应人员列表人空
                    // await pay2Db.update('products', {sales: {$in: [Mongodb.ObjectID(_id)]}}, {$pull: {sales: Mongodb.ObjectID(_id)}, $addToSet: {sales: Mongodb.ObjectID(userItem._id)}});

                    // 获取所有绑定禁用销售或班主任的partial课程
                    const cursor = await pay2Db.getCursor('products', { sales: { $in: [ Mongodb.ObjectID(_id) ] } });
                    while (true) {
                        const product = await cursor.next();
                        if (!product) {
                            break;
                        }

                        // 更新partial中contact中联系人信息
                        await pay2Db.updateOne('products', { _id: Mongodb.ObjectID(product._id) }, { $pull: { sales: Mongodb.ObjectID(_id) } }, { returnOriginal: false });
                        await pay2Db.updateOne('products', { _id: Mongodb.ObjectID(product._id) }, { $addToSet: { sales: Mongodb.ObjectID(userItem._id) } }, { returnOriginal: false });
                        // if(!updatePartialItem.ok || !updatePartialItem.value) throw new Error('更新课程销售或班班主任联系人信息失败');
                    }
                }

                if (roleItem.tag === '一对多班主任') {
                    // 如果是一对多班主任，那先清空对应产品中禁用一对多班主任名单并且同时填加一个同名角色的一对多班主任人员，尽量保证一对多产品中一对多班主任列表永远不为空，但是不能保证一对多班主任角色对应人员列表人空
                    // await pay2Db.update('products', {classmanagers: {$in: [Mongodb.ObjectID(_id)]}}, {$pull: {classmanagers: Mongodb.ObjectID(_id)}, $addToSet: {classmanagers: Mongodb.ObjectID(userItem._id)}});

                    // 获取所有绑定禁用销售或班主任的partial课程
                    const cursor = await pay2Db.getCursor('products', { classmanagers: { $in: [ Mongodb.ObjectID(_id) ] } });
                    while (true) {
                        const product = await cursor.next();
                        if (!product) {
                            break;
                        }

                        // 更新partial中contact中联系人信息
                        await pay2Db.updateOne('products', { _id: Mongodb.ObjectID(product._id) }, { $pull: { classmanagers: Mongodb.ObjectID(_id) } }, { returnOriginal: false });
                        await pay2Db.updateOne('products', { _id: Mongodb.ObjectID(product._id) }, { $addToSet: { classmanagers: Mongodb.ObjectID(userItem._id) } }, { returnOriginal: false });
                        // if(!updatePartialItem.ok || !updatePartialItem.value) throw new Error('更新课程销售或班班主任联系人信息失败');
                    }

                }

               // 获取所有绑定禁用销售或班主任的partial课程
               const cursor = await db.getCursor('packages', { type: '_partial', 'contact._id': Mongodb.ObjectID(_id) });
               while (true) {
                   const partial = await cursor.next();
                   if (!partial) {
                       break;
                   }

                    // 更新partial中contact中联系人信息
                    const updatePartialItem = await db.updateOne('packages', { _id: Mongodb.ObjectID(partial._id) }, {
                        $set: {
                            'contact._id': Mongodb.ObjectID(userItem._id),
                            'contact.name': userItem.name,
                            'contact.mobile': userItem.mobile,
                            'contact.wechat': userItem.wechat ? userItem.wechat : {},
                            'contact.qrCode': userItem.qrCode ? userItem.qrCode : '',
                        },
                    }, { returnOriginal: false });
                    if (!updatePartialItem.ok || !updatePartialItem.value) throw new Error('更新课程销售或班班主任联系人信息失败');
               }
            }
        }

        return { success: true, msg: '更新用户成功' };
    },

    // 重置密码
    async resetPassword(parent, args, { db, systemAdminDb }, info) {
        const { _id } = args;
        const defaultPassword = 'geekstar';

        // 生成密码
        const salt = await bcrypt.genSalt(10);
        const password = await bcrypt.hash(defaultPassword, salt);

        // 更新用户，去除重置密码时将isReset置0的问题
        const result = await systemAdminDb.updateOne('system_users', { _id: Mongodb.ObjectID(_id) }, { $set: { password, isReset: 1, updateTime: new Date() } });
        if (!result.ok || !result.value) throw new Error('重置用户密码失败');

        return { success: true, msg: '重置用户密码成功' };
    },

    // 重置学生密码
    async resetStudentPasswd(parent, args, { db, systemAdminDb }, info) {
        const { mobile } = args;
        const hashedPassword = await bcrypt.hash(mobile.substring(mobile.length - 6), 10);
        const user = await db.updateOne('users', { mobile }, { $set: { hashedPassword } }, { returnOriginal: false });
        if (!user || !user.value) throw new Error('修改学生密码失败');

        // 发送短信
        const sale = await systemAdminDb.findOne('system_users', { _id: Mongodb.ObjectID(parent._id) }, { projection: { name: true, mobile: true } });
        if (!sale) throw new Error('当前销售不存在');
        const smsResult = await sendMsg(mobile, { password: mobile.substring(mobile.length - 6), teacher: sale.name, phone: sale.mobile });
        if (!smsResult) throw new Error('密码已经重置成功，但通知短信发送失败');

        return { success: true, msg: '重置学生密码成功' };
    },

    // 用户首次登陆时修改密码
    async updatePassword(parent, args, { db, systemAdminDb }, info) {
        const { newPassword } = args;

        // 生成密码
        const salt = await bcrypt.genSalt(10);
        const password = await bcrypt.hash(newPassword, salt);

        // 更新用户
        const result = await systemAdminDb.updateOne('system_users', { _id: Mongodb.ObjectID(parent._id) }, { $set: { password, updateTime: new Date() }, $inc: { isReset: 1 } });
        if (!result.ok || !result.value) throw new Error('修改密码失败');

        return { success: true, msg: '修改密码成功' };
    },

    // 登陆系统用户
    async login(parent, args, { db, systemAdminDb }, info) {
        const { mobile, password } = args;

        // 根据手机号判断用户是否存在
        const result = await systemAdminDb.findOne('system_users', { mobile });
        if (!result) throw new Error('当前用户未注册，请先联系管理员进行注册');

        // 使用bcrypt对加密密码进行解密匹配
        const isMatch = await bcrypt.compare(password, result.password);
        if (!isMatch) throw new Error('输入密码错误，请重新输入');

        // 判断当前用户是否被禁用
        if (result.isOn !== 1) throw new Error('对不起，您已经被禁用，请联系管理员激活');

        // 格式化当前用户的角色ID
        const roleIds = result.roleId.map(id => {
            return Mongodb.ObjectID(id);
        });

        // 获取角色信息
        const role = await systemAdminDb.find('system_roles', { _id: { $in: roleIds } }, { projection: { _id: false, name: true } });
        if (role && (role.length === 0)) throw new Error('对不起，当前用户未还没有分配角色');

        // 获取当前用户的所有角色名称
        const roleNameList = role.map(item => {
            return item.name;
        });

        // 生成jwt
        const jwtData = { _id: result._id, role: roleNameList };
        const token = await jsonwebtoken.sign(jwtData, 'geekstar', { expiresIn: 3600 * 1000 });
        if (!token) throw new Error('生成token失败');

        return { token };
    },

    // 创建资源
    async createResource(parent, args, { db, systemAdminDb }, info) {
        const { icon, matchFlag, name, parentId, parentName, parentType, perms, type } = args.params;

        // 路由标志不能重复，因为他是匹配路由的唯一标志,按钮除外
        if (type !== 2) {
            const flag = await systemAdminDb.findOne('system_menus', { matchFlag });
            if (flag) throw new Error('路由标志不能重复');
        }

        const isExists = await systemAdminDb.findOne('system_menus', { name, type });
        if (isExists) throw new Error('同一类型资源不能重名');

        const idRet = await systemAdminDb.updateOne('auto_incr_ids', {}, { $inc: { id: 1 } }, { returnOriginal: false });
        if (!idRet.ok || !idRet.value) throw new Error('生成自动ID失败，请重新创建资源');

        const resourceRet = await systemAdminDb.insertOne('system_menus', { id: idRet.value.id, icon, matchFlag, name, parentId, parentName, parentType, perms, type, createTime: new Date(), updateTime: new Date() });
        if (!resourceRet.ok) throw new Error('插入资源失败，请重新创建资源');

        return { success: true, msg: '创建资源成功' };
    },

    // 更新资源
    async updateResource(parent, args, { db, systemAdminDb }, info) {
        const { _id, icon, matchFlag, name, parentId, parentName, parentType, perms, type } = args.params;

        const menusList = await systemAdminDb.find('system_menus', { name, type });
        let isExists = false;
        for (const menu of menusList) {
            if (menu._id != _id) {
                isExists = true;
                break;
            }
        }
        if (isExists) throw new Error('同一类型资源不能重名');

        const updateRet = await systemAdminDb.updateOne('system_menus', { _id: Mongodb.ObjectID(_id) }, { $set: { icon, matchFlag, name, parentId, parentName, parentType, perms, type, updateTime: new Date() } });
        if (!updateRet.ok || !updateRet.value) throw new Error('更新资源失败');

        return { success: true, msg: '更新资源成功' };
    },

    // 删除资源
    async deleteResource(parent, args, { db, systemAdminDb }, info) {
        const { ids } = args;

        const updateRet = await systemAdminDb.delete('system_menus', { id: { $in: ids } });
        if (!updateRet.ok) throw new Error('删除资源失败');

        return { success: true, msg: '删除资源成功' };
    },

    // 创建角色
    async createRole(parent, args, { db, systemAdminDb }, info) {
        const { name, remark } = args.params;

        const isExists = await systemAdminDb.findOne('system_roles', { name });
        if (isExists) throw new Error('当前角色已经存在，请重新创建');

        // 保证tag不变
        const roleResult = await systemAdminDb.insertOne('system_roles', { name, remark, createTime: new Date(), updateTime: new Date(), tag: name });
        if (!roleResult.ok) throw new Error('创建角色失败，请重新创建');

        return { success: true, msg: '创建角色成功' };
    },

    // 更新角色
    async updateRole(parent, args, { db, systemAdminDb }, info) {
        const { _id, name, remark } = args.params;

        // 先判断更新的角色名称是否已经存在
        const roleList = await systemAdminDb.find('system_roles', { name });
        let isExists = false;
        for (const role of roleList) {
            if (role._id != _id) {
                isExists = true;
                break;
            }
        }
        if (isExists) throw new Error('当前角色已存在');

        const roleResult = await systemAdminDb.updateOne('system_roles', { _id: Mongodb.ObjectID(_id) }, { $set: { name, remark, updateTime: new Date() } });
        if (!roleResult.ok || !roleResult.value) throw new Error('更新角色失败，请重新更新');

        return { success: true, msg: '更新角色成功' };
    },

    // 创建角色与资源关系
    async createRoleResourceRel(parent, args, { db, systemAdminDb }, info) {
        const { roleId, resourceIds } = args;

        let roleMenuResult = await systemAdminDb.delete('system_roles_menus', { roleId: Mongodb.ObjectID(roleId) });
        if (!roleMenuResult.ok) throw new Error('清除角色资源列表失败');

        if (resourceIds.length === 0) return { success: true, msg: '创建角色资源列表成功' };

        const roleResourceList = [];
        for (const resourceId of resourceIds) {
            roleResourceList.push({ roleId: Mongodb.ObjectID(roleId), resourceId });
        }

        roleMenuResult = await systemAdminDb.insert('system_roles_menus', roleResourceList);
        if (!roleMenuResult.ok) throw new Error('创建角色资源列表失败');

        return { success: true, msg: '创建角色资源列表成功' };
    },

    // 更新学生相关信息
    async updateStudent(parent, args, { db }, info) {
        const { mobile, newMobile } = args;

        const user = await db.updateOne('users', { mobile }, { $set: { mobile: newMobile } });
        if (!user.ok || !user.value) throw new Error('更新学生信息失败');

        return { success: true, msg: '更新学生信息成功' };
    },

    // 发送证书消息
    async sendProgramCertMsg(parent, args, {}, info) {
        const { packageId, type, mobile } = args;
        const certResult = await sendCertMsg(packageId, type, mobile);
        if (certResult && !certResult.success) throw new Error('发送证书信息失败');
        return { success: true, msg: '发送证书信息成功' };
    },

    // 上传单个文件
    async singleUpload(parent, { file }) {
        const result = await processUpload(file);
        return result;
    },

    // 创建IM课程
    async createImPackage(parent, args, { db }, info) {
        const { name, state, trial, classPerUnit, totalUnits, poster, openTime, freePlay, contentType } = args.params;

        // Strach一对多课堂类型
        if (contentType === 'Scratch') {
            // 判断课程名称是否已经存在
            let packageQueryRet = await db.findOne('packages', { 'name.zh': name });
            if (packageQueryRet) throw new Error('当前课程已经存在');

            const tag = 'im-' + uid();
            const freePlayCourseId = new Mongodb.ObjectID(Date.now());
            const packageInsertRet = await db.insertOne('packages', {
                name: {
                    en: name,
                    zh: name,
                },
                units: [],
                state,
                trial,
                type: 'im',
                tag,
                contentType,
                classPerUnit,
                totalUnits,
                createTime: new Date(),
                updateTime: new Date(),
                poster,
                freePlay: { courseId: freePlayCourseId },
                ... ((openTime) ? { openTime: moment(Number(openTime)).toDate() } : null),
            });
            if (!packageInsertRet.ok) throw new Error('创建IM课程失败');

            // 生成自由创作
            // 在courses表中创建对应的levels
            const courseUpdate = await db.updateOne('courses', { _id: freePlayCourseId }, { $set: {
                tag: `im-tag-freeplay-${uid()}`,
                name: {
                    zh: `im-freeplay-zh-${uid()}`,
                    en: `im-freeplay-en-${uid()}`,
                },
                defaultLayout: 'scratch_recorded/funcq',
                state: 'production',
                keywords: 'im-freeplay',
                levels: [{
                        levelId: Mongodb.ObjectID(freePlay.levelId),
                        name: {
                            en: freePlay.title,
                            zh: freePlay.title,
                        },
                        description: freePlay.description ? freePlay.description : '',
                        media: {
                            sb3: freePlay.sb3,
                            solutionSb3: freePlay.solutionSb3,
                            projectCover: freePlay.projectCover,
                            video: freePlay.video,
                        },
                        layout: 'scratch_recorded/funcq',
                }],
            } }, { upsert: true, returnOriginal: false });
            if (!courseUpdate.ok || !courseUpdate.value) throw new Error('增加自由创建信息失败');

            // 返回查询后的数据
            packageQueryRet = await db.findOne('packages', { tag });

            // 手动拼接自由创作内容，不再查询courese库
            packageQueryRet.freePlay = {
                courseId: freePlayCourseId,
                title: freePlay.title,
                description: freePlay.description,
                levelId: freePlay.levelId,
                sb3: freePlay.sb3,
                solutionSb3: freePlay.solutionSb3,
                projectCover: freePlay.projectCover,
                video: freePlay.video,
            };

            // 返回查询后的数据: 其实没必要，历史原因，保留返回吧
            return packageQueryRet;
        }

        // Python一对多课堂类型
        if (contentType === 'Python') {
            // 判断课程名称是否已经存在
            let packageQueryRet = await db.findOne('packages', { 'name.zh': name });
            if (packageQueryRet) throw new Error('当前课程已经存在');

            const tag = 'im-' + uid();
            const packageInsertRet = await db.insertOne('packages', {
                name: {
                    en: name,
                    zh: name,
                },
                units: [],
                state,
                trial,
                type: 'im',
                tag,
                contentType,
                classPerUnit,
                totalUnits,
                createTime: new Date(),
                updateTime: new Date(),
                poster,
                ... ((openTime) ? { openTime: moment(Number(openTime)).toDate() } : null),
            });
            if (!packageInsertRet.ok) throw new Error('创建IM课程失败');

            // 返回查询后的数据: 其实没必要，历史原因，保留返回吧
            packageQueryRet = await db.findOne('packages', { tag });

            return packageQueryRet;
        }

    },

    // 更新课程包信息
    async updateImPackage(parent, args, { db }, info) {
        const { _id, name, state, trial, classPerUnit, totalUnits, poster, openTime, freePlay, contentType } = args.params;

        // Strach一对多课堂类型
        if (contentType === 'Scratch') {
            // 根据前端是否传自由创作id来判断是更新自由创建信息还是创建
            const freePlayCourseId = (freePlay.courseId) ? (Mongodb.ObjectID(freePlay.courseId)) : (new Mongodb.ObjectID(Date.now()));
            const packageUpdateRet = await db.updateOne('packages', { _id: Mongodb.ObjectID(_id) }, { $set: {
                name: {
                    en: name,
                    zh: name,
                },
                state,
                trial,
                contentType,
                classPerUnit,
                totalUnits,
                updateTime: new Date(),
                poster,
                freePlay: { courseId: freePlayCourseId },
                ... ((openTime) ? { openTime: moment(Number(openTime)).toDate() } : null),
            } }, { returnOriginal: false });

            if (!packageUpdateRet.ok || !packageUpdateRet.value) throw new Error('更新IM课程失败');

            // 生成自由创作
            // 在courses表中创建对应的levels
            const courseUpdate = await db.updateOne('courses', { _id: freePlayCourseId }, { $set: {
                tag: `im-tag-freeplay-${uid()}`,
                name: {
                    zh: `im-freeplay-zh-${uid()}`,
                    en: `im-freeplay-en-${uid()}`,
                },
                defaultLayout: 'scratch_recorded/funcq',
                state: 'production',
                keywords: 'im-freeplay',
                levels: [{
                    levelId: Mongodb.ObjectID(freePlay.levelId),
                    name: {
                        en: freePlay.title,
                        zh: freePlay.title,
                    },
                    description: freePlay.description ? freePlay.description : '',
                    media: {
                        sb3: freePlay.sb3,
                        solutionSb3: freePlay.solutionSb3,
                        projectCover: freePlay.projectCover,
                        video: freePlay.video,
                    },
                    layout: 'scratch_recorded/funcq' }],
            } }, { upsert: true, returnOriginal: false });
            if (!courseUpdate.ok || !courseUpdate.value) throw new Error('更新自由创作信息失败');

            // 手动拼接自由创作内容，不再查询courese库
            packageUpdateRet.value.freePlay = {
                courseId: freePlayCourseId,
                title: freePlay.title,
                description: freePlay.description,
                levelId: freePlay.levelId,
                sb3: freePlay.sb3,
                solutionSb3: freePlay.solutionSb3,
                projectCover: freePlay.projectCover,
                video: freePlay.video,
            };

            return packageUpdateRet.value;
        }

        // Python一对多课堂类型
        if (contentType === 'Python') {
            const packageUpdateRet = await db.updateOne('packages', { _id: Mongodb.ObjectID(_id) }, { $set: {
                name: {
                    en: name,
                    zh: name,
                },
                state,
                trial,
                contentType,
                classPerUnit,
                totalUnits,
                updateTime: new Date(),
                poster,
                ... ((openTime) ? { openTime: moment(Number(openTime)).toDate() } : null),
            } }, { returnOriginal: false });

            if (!packageUpdateRet.ok || !packageUpdateRet.value) throw new Error('更新IM课程失败');

            return packageUpdateRet.value;
        }
    },

    // 创建课程包单元信息
    async createImPackageUnit(parent, args, { db }, info) {
        const {
            packageId, // 课程包ID
            title, // 标题
            classpack, // 课时数
            knowledgePoint, // 知识点
            description, // 简介
            comments, // 备注
            duration, // 时长
            enabled,
            // quiz,                // 习题闯关, 是一个数组, [{levelId, description}]
            // challenge,           // 课后挑战,是一个对象，{ levelId, media, description }
            noteUrl, // 多媒体-讲义
            previewCoverUrl, // 多媒体-预习封面图片
            coverUrl, // 单元封面图片
            plot, // 剧情
        } = args.params;

        // 先判断课程信息是否创建过
        const packageQuery = await db.findOne('packages', { _id: Mongodb.ObjectID(packageId) });
        if (!packageQuery) throw new Error('当前创建单元所在课程不存在');

        // 判断课时信息是否存在，如果存在，则直接抛出错误
        if (packageQuery.units && (Array.isArray(packageQuery.units)) && (packageQuery.units.length > 0)) {
            for (const unitId of packageQuery.units) {
                const unit = await db.findOne('units', { _id: Mongodb.ObjectID(unitId) }, { classpack: true });
                if (unit && (unit.classpack === classpack)) throw new Error('当前课时信息已经存在');
            }
        }

        // 生成im、quiz、challenge的course信息，方便后续集成
        const imId = new Mongodb.ObjectID(Date.now()),
quizId = new Mongodb.ObjectID(Date.now()),
challengeId = new Mongodb.ObjectID(Date.now());
        const courseResult = await db.insert('courses', [{
            _id: imId,
            tag: `im-tag-segment-${uid()}`,
            name: {
                zh: `im-segment-zh-${uid()}`,
                en: `im-segment-en-${uid()}`,
            },
            defaultLayout: 'scratch_recorded/funcq',
            levels: [],
            state: 'production',
	        keywords: 'im-segment',
        }, {
            _id: quizId,
            tag: `im-tag-quiz-${uid()}`,
            name: {
                zh: `im-quiz-zh-${uid()}`,
                en: `im-quiz-en-${uid()}`,
            },
            defaultLayout: 'scratch_recorded/funcq',
            levels: [],
            state: 'production',
	        keywords: 'im-quiz',
        },
        {
            _id: challengeId,
            tag: `im-tag-challenge-${uid()}`,
            name: {
                zh: `im-challenge-zh-${uid()}`,
                en: `im-challenge-en-${uid()}`,
            },
            defaultLayout: 'scratch_recorded/funcq',
            levels: [],
            state: 'production',
	        keywords: 'im-challenge',
        }]);
        if (!courseResult.ok) throw new Error('创建课程信息失败');

        // 根据课程类型生成评分信息
        const segmentData = [];
        // 如果是体验课
        if (packageQuery.trial) {
            segmentData.push({
                _id: new Mongodb.ObjectID(Date.now()),
                type: '评分',
                fields: [
                  { type: 'score', name: '学习兴趣' },
                  { type: 'score', name: '逻辑思维' },
                  { type: 'score', name: '问题解析' },
                  { type: 'score', name: '指令理解' },
                  { type: 'text', name: '' },
                ],
            });
        } else { // 如果是正式课
            segmentData.push({
                _id: new Mongodb.ObjectID(Date.now()),
                type: '评分',
                fields: [
                  { type: 'score', name: '课堂表现' },
                  { type: 'score', name: '知识掌握' },
                  { type: 'score', name: '互动反馈' },
                  { type: 'text', name: '' },
                ],
            });
        }

        // 创建单元信息
        const unitInsert = await db.updateOne('units', { _id: new Mongodb.ObjectID(Date.now()) }, { $set: {
            title, // 标题
            classpack, // 课时数
            enabled,
            duration, // 时长
            description: [ description, comments, knowledgePoint ], // 0：简介，1：备注，2: 知识点
            segments: segmentData, // 默认先把评分信息放入片段数组中
            courses: [
                { type: 'im', courseId: imId },
                { type: 'quiz', courseId: quizId },
                { type: 'challenge', courseId: challengeId },
            ],
            media: {
                note: noteUrl, // 多媒体-讲义
                cover: coverUrl, // 单元封面
                previewCover: previewCoverUrl, // 多媒体-预习封面图片
                plot, // 剧情
            },
           state: 'production',
           name: {
            en: title,
            zh: title,
           },
           classPerUnit: 2,
           type: 'im',
        } }, { upsert: true, returnOriginal: false });

        if (!unitInsert.ok || !unitInsert.value) throw new Error('生成单元信息失败');

        // 获取单元ID,其实不用再查询一边，先这样吧
        const unitResult = await db.findOne('units', { _id: Mongodb.ObjectID(unitInsert.value._id) });
        if (!unitResult) throw new Error('当前单元不存在');

        // 兼容description 0：简介，1：备注，2: 知识点
        if (unitResult.description && Array.isArray(unitResult.description)) {
            const descriptions = unitResult.description;
            unitResult.description = descriptions[0] || '';
            unitResult.comments = descriptions[1] || '';
            unitResult.knowledgePoint = descriptions[2] || '';
        }

        // 在课程包增加单元信息，参考现有的逻辑
        const packageResult = await db.updateOne('packages', { _id: Mongodb.ObjectID(packageId) }, { $addToSet: { units: Mongodb.ObjectID(unitResult._id) } }, { returnOriginal: false });
        if (!packageResult.ok || !packageResult.value) throw new Error('更新课程信息失败');

        // 返回单元信息
        return unitResult;
    },

    // 更新课程包单元信息
    async updateImPackageUnit(parent, args, { db }, info) {
        const {
            packageId,
            _id,
            title, // 标题
            classpack, // 课时数
            knowledgePoint, // 知识点
            description, // 简介
            duration, // 时长
            comments, // 备注
            enabled, // 是否隐藏
            noteUrl, // 多媒体-讲义
            previewCoverUrl, // 多媒体-预习封面图片
            coverUrl, // 单元封面图片
            plot, // 剧情
        } = args.params;

        // 先判断课程信息是否创建过
        const packageQuery = await db.findOne('packages', { _id: Mongodb.ObjectID(packageId) });
        if (!packageQuery) throw new Error('当前创建单元所在课程不存在');

        // 判断课时信息是否存在，如果存在，则直接抛出错误
        if (packageQuery.units && (Array.isArray(packageQuery.units)) && (packageQuery.units.length > 0)) {
            for (const unitId of packageQuery.units) {
                const unit = await db.findOne('units', { _id: Mongodb.ObjectID(unitId) }, { classpack: true });
                if (unit && (unit.classpack === classpack) && (unit._id.toString() != (_id.toString()))) throw new Error('当前课时信息已经存在');
            }
        }

        // 更新单元信息
        const unitUpdateResult = await db.updateOne('units', { _id: Mongodb.ObjectID(_id) }, { $set: {
            title, // 标题
            classpack, // 课时数
            enabled,
            duration, // 时长
            description: [ description, comments, knowledgePoint ], // 0：简介，1：备注，2: 知识点
            name: { en: title, zh: title },
            media: {
                note: noteUrl, // 多媒体-讲义
                cover: coverUrl, // 单元封面
                previewCover: previewCoverUrl, // 多媒体-预习封面图片
                plot, // 剧情
            },
        } }, { returnOriginal: false });

        if (!unitUpdateResult.ok) throw new Error('更新课程单元信息失败');
        if (unitUpdateResult.ok && !unitUpdateResult.value) throw new Error('当前课程单元信息不存在');

        // 兼容description 0：简介，1：备注，2: 知识点
        if (unitUpdateResult.value.description && Array.isArray(unitUpdateResult.value.description)) {
            const descriptions = unitUpdateResult.value.description;
            unitUpdateResult.value.description = descriptions[0] || '';
            unitUpdateResult.value.comments = descriptions[1] || '';
            unitUpdateResult.value.knowledgePoint = descriptions[2] || '';
        }

        // 返回单元信息
        return unitUpdateResult.value;
    },

    // 创建习题闯关
    async createImQuiz(parent, args, { db }, info) {
        const { courseId, quiz } = args;

        // 先判断当前单元信息下已经存在过习题闯关，如果存在，直接返回提示
        // let unitQuery = await db.findOne('courses', {_id: Mongodb.ObjectID(courseId), "levels.1": {$exists: true}}); // 1表示数据长度为1
        const unitQuery = await db.findOne('courses', { _id: Mongodb.ObjectID(courseId) });
        if (!unitQuery) throw new Error('当前课程信息不存在');

        const quizArray = [];
        for (let i = 0; i < quiz.length; i++) {
            quizArray.push({
                // _id: new Mongodb.ObjectID(Date.now()).toString(),
                levelId: Mongodb.ObjectID(quiz[i]),
                name: {
                    en: i + 1,
                    zh: '选择题' + (i + 1),
                },
                layout: 'scratch_recorded/funcq',
            });
        }

        // 获取习题闯关与课后挑战的主键ID
        const quizCourseResult = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId) }, { $set: { levels: quizArray } }, { returnOriginal: false });
        if (!quizCourseResult.ok || !quizCourseResult.value) throw new Error('创建习题闯关失败');

        // 根据levelId中获取levels中的信息
        if (quizCourseResult.value.levels && Array.isArray(quizCourseResult.value.levels) && (quizCourseResult.value.levels.length > 0)) {
            for (const level of quizCourseResult.value.levels) {
                const levelRet = await db.findOne('levels', { _id: Mongodb.ObjectID(level.levelId) });
                if (!levelRet) continue;
                level.levelId = levelRet;
            }
        }

        return quizCourseResult.value;
    },

    // 更新习题闯关
    async updateImQuiz(parent, args, { db }, info) {
        const { courseId, quiz } = args;

        // 先判断当前课程信息是否已经存在，如果不存在，则直接返回
        const courseQuery = await db.findOne('courses', { _id: Mongodb.ObjectID(courseId) });
        if (!courseQuery) throw new Error('当前课程信息不存在');

        const quizArray = [];
        for (let i = 0; i < quiz.length; i++) {
            quizArray.push({
                // _id: new Mongodb.ObjectID(Date.now()).toString(),
                levelId: Mongodb.ObjectID(quiz[i]),
                name: {
                    en: i + 1,
                    zh: '选择题' + (i + 1),
                },
                layout: 'scratch_recorded/funcq',
            });
        }

        const quizResult = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId) }, { $set: { levels: quizArray } }, { returnOriginal: false });
        if (!quizResult.ok || !quizResult.value) throw new Error('更新习题闯关数据失败');

        // 根据levelId中获取levels中的信息
        if (quizCourseResult.value.levels && Array.isArray(quizCourseResult.value.levels) && (quizCourseResult.value.levels.length > 0)) {
            for (const level of quizCourseResult.value.levels) {
                const levelRet = await db.findOne('levels', { _id: Mongodb.ObjectID(level.levelId) });
                if (!levelRet) continue;
                level.levelId = levelRet;
            }
        }

        return quizResult.value;
    },

    // 删除习题闯关
    async removeImQuiz(parent, args, { db }, info) {
        const { courseId, levelId } = args;

        // 先判断当前课程信息是否已经存在，如果不存在，则直接返回
        const courseQuery = await db.findOne('courses', { _id: Mongodb.ObjectID(courseId) });
        if (!courseQuery) throw new Error('当前课程信息不存在');

        const quizResult = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId) }, { $pull: { levels: { levelId: Mongodb.ObjectID(levelId) } } }, { returnOriginal: false });
        if (!quizResult.ok || !quizResult.value) throw new Error('更新习题闯关数据失败');

        // 根据levelId中获取levels中的信息
        if (quizResult.value.levels && Array.isArray(quizResult.value.levels) && (quizResult.value.levels.length > 0)) {
            for (const level of quizResult.value.levels) {
                const levelRet = await db.findOne('levels', { _id: Mongodb.ObjectID(level.levelId) });
                if (!levelRet) continue;
                level.levelId = levelRet;
            }
        }

        return quizResult.value;
    },

    // 创建课后挑战
    async createImChallenge(parent, args, { db }, info) {
        const {
            courseId,
            title,
            description,
            levelId,
            sb3BeginUrl,
            sb3EndUrl,
            coverUrl,
            videoUrl,
        } = args.params;

        const unitQuery = await db.findOne('courses', { _id: Mongodb.ObjectID(courseId) });
        if (!unitQuery) throw new Error('当前课程信息不存在');

        // 创建课后挑战数据结构
        const challengeObj = {
            tag: `${uid()}${Date.now()}`,
            levelId: Mongodb.ObjectID(levelId),
            name: {
                en: title,
                zh: title,
            },
            media: {
                sb3: sb3BeginUrl,
                solutionSb3: sb3EndUrl,
                projectCover: coverUrl,
                video: videoUrl,
            },
            description,
            layout: 'app_layout',
        };

        // 获取习题闯关与课后挑战的主键ID
        const challengeCourseResult = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId) }, { $set: { levels: [ challengeObj ] } }, { returnOriginal: false });
        if (!challengeCourseResult.ok || !challengeCourseResult.value) throw new Error('更新课后挑战课程信息失败');

        return challengeCourseResult.value;
    },

    // 更新课后挑战
    async updateImChallenge(parent, args, { db }, info) {
        const {
            tag,
            title,
            courseId,
            description,
            levelId,
            sb3BeginUrl,
            sb3EndUrl,
            coverUrl,
            videoUrl,
        } = args.params;

        // 先判断当前课程信息是否已经存在，如果不存在，则直接返回
        const courseQuery = await db.findOne('courses', { _id: Mongodb.ObjectID(courseId) });
        if (!courseQuery) throw new Error('当前课程信息不存在');

        // 返回更新后的数据，其实现在不用返回，先保持这样
        const challengeResult = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId), 'levels.tag': tag }, { $set:
            {
                'levels.$.levelId': Mongodb.ObjectID(levelId),
                'levels.$.media.sb3': sb3BeginUrl,
                'levels.$.media.solutionSb3': sb3EndUrl,
                'levels.$.media.projectCover': coverUrl,
                'levels.$.media.video': videoUrl,
                'levels.$.description': description,
                'levels.$.name': { en: title, zh: title },
            } },
            { returnOriginal: false });
        if (!challengeResult.ok) throw new Error('更新课后挑战数据失败');

        return challengeResult.value;
    },

    // 更新一对多Python课后挑战
    async updateImPythonChallenge(parent, args, { db }, info) {
        const {
            tag,
            title,
            courseId,
            description,
            levelId,
            videoUrl,
            projectCoverUrl,
            projectVideoCoverUrl,
        } = args;

        // 先判断当前课程信息是否已经存在，如果不存在，则直接返回
        const courseQuery = await db.findOne('courses', { _id: Mongodb.ObjectID(courseId) });
        if (!courseQuery) throw new Error('当前课程信息不存在');

        // 更新指定的一对多Python课后挑战
        const challengeResult = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId), 'levels.tag': tag }, { $set:
        {
            'levels.$.levelId': Mongodb.ObjectID(levelId),
            'levels.$.media.projectCover': projectCoverUrl,
            'levels.$.media.projectVideoCover': projectVideoCoverUrl,
            'levels.$.media.video': videoUrl,
            'levels.$.description': description,
            'levels.$.name': { en: title, zh: title },
        } }, { returnOriginal: false });
        if (!challengeResult.ok || !challengeResult.value) throw new Error('更新一对多Python课后挑战数据失败');

        return { success: true, msg: '更新一对多Python课后挑战成功' };
    },

    // 创建片段
    async createImSegment(parent, args, { db }, info) {
        const {
            packageId,
            unitId,
            courseId,
            type,
            title,
            description,
            videoUrl,
            levelId,
            pdfUrl,
            sb3BeginUrl,
            sb3EndUrl,
            coverUrl,
            isSkipVideo,
        } = args.params;

        let unitUpdate = null;
        // 根据type去做判断，暂时前端写死片段类型(视频、编程、课件、单选题、多选题)
        if (type === '视频') {
            // 更新单元中片段信息
            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
                _id: new Mongodb.ObjectID(Date.now()),
                type,
                title,
                description,
                isSkipVideo,
                url: videoUrl,
            } } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('创建视频片段失败');
        } else if (type === '编程') {
            const segmentId = new Mongodb.ObjectID(Date.now());
            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
                _id: segmentId,
                type,
                title,
                levelId,
                description,
                media: {
                    sb3: sb3BeginUrl,
                    solutionSb3: sb3EndUrl,
                    projectCover: coverUrl,
                    video: videoUrl,
                },
                url: '', // 暂时不考虑编程题的url，最后再确定
            } } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('创建编程片段失败..');

            // 在courses表中创建对应的levels
            const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId) }, { $addToSet: { levels: {
                segmentId,
                levelId: Mongodb.ObjectID(levelId),
                name: {
                    en: title,
                    zh: title,
                },
                description: description ? description : '', // 保证没有时为空串
                media: {
                    sb3: sb3BeginUrl,
                    solutionSb3: sb3EndUrl,
                    projectCover: coverUrl,
                    video: videoUrl,
                },
                layout: 'scratch_recorded/funcq',
            } } });
            if (!courseUpdate.ok || !courseUpdate.value) throw new Error('增加编程信息失败');

        } else if (type === '课件') {
            // 更新单元中片段信息
            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
                _id: new Mongodb.ObjectID(Date.now()),
                type,
                title,
                description,
                url: pdfUrl,
            } } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('创建课件片段失败');
        } else if (type === '课前准备') {
            // 更新单元中片段信息
            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
                _id: new Mongodb.ObjectID(Date.now()),
                type,
                title,
                description,
                url: coverUrl,
            } } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('创建课前准备片段失败');
        } else if (type === '图片') {
            // 更新单元中片段信息
            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
                _id: new Mongodb.ObjectID(Date.now()),
                type,
                title,
                description,
                url: coverUrl,
            } } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('创建图片片段失败');
        } else if (type === '单选题') {
            const segmentId = new Mongodb.ObjectID(Date.now());
            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
                _id: segmentId,
                type,
                title,
                levelId,
                description,
                url: '', // 暂时不考虑编程题的url，最后再确定
            } } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('创建单选题片段失败');

            // 在courses表中创建对应的levels
            const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId) }, { $addToSet: { levels: {
                segmentId,
                levelId: Mongodb.ObjectID(levelId),
                name: {
                    en: title,
                    zh: title,
                },
                layout: 'scratch_recorded/funcq',
            } } });
            if (!courseUpdate.ok || !courseUpdate.value) throw new Error('增加单选题信息失败');
        } else if (type === '多选题') {
            const segmentId = new Mongodb.ObjectID(Date.now());
            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
                _id: segmentId,
                type,
                title,
                levelId,
                description,
                url: '', // 暂时不考虑编程题的url，最后再确定
            } } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('创建多选题片段失败');

            // 在courses表中创建对应的levels
            const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId) }, { $addToSet: { levels: {
                segmentId,
                levelId: Mongodb.ObjectID(levelId),
                name: {
                    en: title,
                    zh: title,
                },
                layout: 'scratch_recorded/funcq',
            } } });
            if (!courseUpdate.ok || !courseUpdate.value) throw new Error('增加多选题信息失败');
        } else if (type === '思维导图') {
            const segmentId = new Mongodb.ObjectID(Date.now());
            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
                _id: segmentId,
                type,
                title,
                levelId,
                description,
                media: {
                    video: videoUrl,
                },
                url: '', // 暂时不考虑编程题的url，最后再确定
            } } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('创建思维导图题片段失败');

            // 在courses表中创建对应的levels
            const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId) }, { $addToSet: { levels: {
                segmentId,
                levelId: Mongodb.ObjectID(levelId),
                name: {
                    en: title,
                    zh: title,
                },
                media: { video: videoUrl },
                layout: 'scratch_recorded/funcq',
            } } });
            if (!courseUpdate.ok || !courseUpdate.value) throw new Error('增加思维导图题信息失败');
        } else {
            throw new Error(`不支持创建当前${type}片段`);
        }

        // 去除index后，为方便片段排序，重新组装片段数据
        const segmentsResult = unitUpdate.value.segments.filter(item => {
            return item.type != '评分';
        });

        const scoreItem = unitUpdate.value.segments.find(item => {
            return item.type == '评分';
        });

        // 保证评分数据存在
        if (scoreItem) segmentsResult.push(scoreItem);

        // 更新排序后的结果
        unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $set: { segments: segmentsResult } }, { returnOriginal: false });
        if (!unitUpdate.ok || !unitUpdate.value) throw new Error('更新排序片段信息失败');
        return unitUpdate.value.segments;
    },

    // 更新片段
    async updateImSegment(parent, args, { db }, info) {
        const {
            packageId,
            unitId,
            courseId,
            segmentId,
            type,
            title,
            description,
            videoUrl,
            levelId,
            pdfUrl,
            sb3BeginUrl,
            sb3EndUrl,
            coverUrl,
            isSkipVideo,
        } = args.params;

        let unitUpdate = null;
        // 根据type去做判断，暂时前端写死片段类型(视频、编程、课件、单选题、多选题)
        if (type === '视频') {
            // 再更新视频片段信息
            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
                'segments.$.title': title,
                'segments.$.description': description,
                'segments.$.url': videoUrl,
                'segments.$.isSkipVideo': isSkipVideo,
                } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('更新视频片段失败');

        } else if (type === '编程') {
            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
                'segments.$.title': title,
                'segments.$.levelId': levelId,
                'segments.$.description': description,
                'segments.$.media.sb3': sb3BeginUrl,
                'segments.$.media.solutionSb3': sb3EndUrl,
                'segments.$.media.projectCover': coverUrl,
                'segments.$.media.video': videoUrl,
                'segments.$.url': '', // 暂时不考虑编程题的url，最后再确定
            } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('更新编程片段失败');

            // 在courses表中创建对应的levels
            const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId), 'levels.segmentId': Mongodb.ObjectID(segmentId) }, { $set: {
                'levels.$.levelId': Mongodb.ObjectID(levelId),
                'levels.$.media.sb3': sb3BeginUrl,
                'levels.$.media.solutionSb3': sb3EndUrl,
                'levels.$.media.projectCover': coverUrl,
                'levels.$.media.video': videoUrl,
                'levels.$.description': description ? description : '', // 保证没有时为空串
                'levels.$.name': {
                    en: title,
                    zh: title,
                },
            } });
            if (!courseUpdate.ok || !courseUpdate.value) throw new Error('更新编程信息失败');

        } else if (type === '课件') {
            // 更新单元中片段信息
            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
                'segments.$.title': title,
                'segments.$.description': description,
                'segments.$.url': pdfUrl,
            } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('更新课件片段失败');
        } else if (type === '课前准备') {
            // 更新单元中片段信息
            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
                'segments.$.title': title,
                'segments.$.description': description,
                'segments.$.url': coverUrl,
            } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('更新课前准备片段失败');
        } else if (type === '图片') {
            // 更新单元中片段信息
            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
                'segments.$.title': title,
                'segments.$.description': description,
                'segments.$.url': coverUrl,
            } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('更新图片片段失败');
        } else if (type === '单选题') {
            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
                'segments.$.title': title,
                'segments.$.levelId': levelId,
                'segments.$.description': description,
                'segments.$.url': '', // 暂时不考虑编程题的url，最后再确定
            } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('更新单选题片段失败');

            // 在courses表中创建对应的levels
            const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId), 'levels.segmentId': Mongodb.ObjectID(segmentId) }, { $set: {
                'levels.$.levelId': Mongodb.ObjectID(levelId),
                'levels.$.name': {
                    en: title,
                    zh: title,
                },
            } });
            if (!courseUpdate.ok || !courseUpdate.value) throw new Error('更新单选题信息失败');
        } else if (type === '多选题') {

            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
                'segments.$.title': title,
                'segments.$.levelId': levelId,
                'segments.$.description': description,
                'segments.$.url': '', // 暂时不考虑编程题的url，最后再确定
            } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('更新多选题片段失败');

            // 在courses表中创建对应的levels
            const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId), 'levels.segmentId': Mongodb.ObjectID(segmentId) }, { $set: {
                'levels.$.levelId': Mongodb.ObjectID(levelId),
                'levels.$.name': {
                    en: title,
                    zh: title,
                },
            } });
            if (!courseUpdate.ok || !courseUpdate.value) throw new Error('更新多选题信息失败');
        } else if (type === '思维导图') {
            unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
                'segments.$.title': title,
                'segments.$.levelId': levelId,
                'segments.$.description': description,
                'segments.$.media': { video: videoUrl },
                'segments.$.url': '', // 暂时不考虑编程题的url，最后再确定
            } }, { returnOriginal: false });
            if (!unitUpdate.ok || !unitUpdate.value) throw new Error('更新思维导图题片段失败');

            // 在courses表中创建对应的levels
            const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId), 'levels.segmentId': Mongodb.ObjectID(segmentId) }, { $set: {
                'levels.$.levelId': Mongodb.ObjectID(levelId),
                'levels.$.media': { video: videoUrl },
                'levels.$.name': {
                    en: title,
                    zh: title,
                },
            } });
            if (!courseUpdate.ok || !courseUpdate.value) throw new Error('更新思维导图题信息失败');
        } else {
            throw new Error(`不支持创建当前${type}片段`);
        }

        // 去除index后，为方便片段排序，重新组装片段数据
        const segmentsResult = unitUpdate.value.segments.filter(item => {
            return item.type != '评分';
        });

        const scoreItem = unitUpdate.value.segments.find(item => {
            return item.type == '评分';
        });

        // 保证评分数据不存在
        if (scoreItem) segmentsResult.push(scoreItem);

        // 更新排序后的结果
        unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $set: { segments: segmentsResult } }, { returnOriginal: false });
        if (!unitUpdate.ok || !unitUpdate.value) throw new Error('更新排序片段信息失败');
        return unitUpdate.value.segments;
    },

    // 删除片段
    async removeImSegment(parent, args, { db }, info) {
        const {
            packageId,
            unitId,
            courseId,
            segmentId,
            type,
        } = args.params;

        let unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $pull: { segments: { _id: Mongodb.ObjectID(segmentId) } } }, { returnOriginal: false });
        if (!unitUpdate.ok || !unitUpdate.value) throw new Error('删除视频片段失败');

        // 填空题与Python编程是针对一对多Python的
        if ((type === '编程') || (type === '单选题') || (type === '多选题') || (type === '思维导图') || (type === '填空题') || (type === 'Python编程')) {
            const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId), 'levels.segmentId': Mongodb.ObjectID(segmentId) }, { $pull: { levels: { segmentId: Mongodb.ObjectID(segmentId) } } });
            if (!courseUpdate.ok || !courseUpdate.value) throw new Error('删除编程信息失败');
        }

        // 去除index后，为方便片段排序，重新组装片段数据
        const segmentsResult = unitUpdate.value.segments.filter(item => {
            return item.type != '评分';
        });

        const scoreItem = unitUpdate.value.segments.find(item => {
            return item.type == '评分';
        });

        // 保证评分数据存在，防止数据异常
        if (scoreItem) segmentsResult.push(scoreItem);

        // 更新排序后的结果
        unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $set: { segments: segmentsResult } }, { returnOriginal: false });
        if (!unitUpdate.ok || !unitUpdate.value) throw new Error('更新排序片段信息失败');

        return unitUpdate.value.segments;
    },

    /* ********Python一对多开始******** */
    // 创建课前准备片段
    async createImPythonPreparationSegment(parent, args, { db }, info) {
        const { unitId, courseId, type, title, description, prepareImgUrl } = args;

        if (type !== '课前准备') throw new Error('课前准备片段类型错误');

        // 更新单元中片段信息
        let unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
            _id: new Mongodb.ObjectID(Date.now()),
            type,
            title,
            description,
            url: prepareImgUrl,
        } } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('创建课前准备片段失败');

        // 去除index后，为方便片段排序，重新组装片段数据
        const segmentsResult = unitUpdate.value.segments.filter(item => {
            return item.type != '评分';
        });

        const scoreItem = unitUpdate.value.segments.find(item => {
            return item.type == '评分';
        });

        // 保证评分数据不存在
        if (scoreItem) segmentsResult.push(scoreItem);

        // 更新排序后的结果
        unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $set: { segments: segmentsResult } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新排序片段信息失败');

        return { success: true, msg: '创建课前准备片段成功' };
    },

    // 更新课前准备片段
    async updateImPythonPreparationSegment(parent, args, { db }, info) {
        const { unitId, courseId, segmentId, type, title, description, prepareImgUrl } = args;

        if (type !== '课前准备') throw new Error('课前准备片段类型错误');

        // 更新单元中片段信息
        const unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
            'segments.$.title': title,
            'segments.$.description': description,
            'segments.$.url': prepareImgUrl,
        } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新课前准备片段失败');

        return { success: true, msg: '更新课前准备片段成功' };
    },

    // 创建思维导图片段
    async createImPythonMindmappingSegment(parent, args, { db }, info) {
        const { unitId, courseId, type, title, description, levelId, videoUrl } = args;

        if (type !== '思维导图') throw new Error('思维导图片段类型错误');

        const segmentId = new Mongodb.ObjectID(Date.now());
        let unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
            _id: segmentId,
            type,
            title,
            levelId,
            description,
            media: {
                video: videoUrl,
            },
        } } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('创建思维导图题片段失败');

        // 在courses表中创建对应的levels
        const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId) }, { $addToSet: { levels: {
            segmentId,
            levelId: Mongodb.ObjectID(levelId),
            name: {
                en: title,
                zh: title,
            },
            media: { video: videoUrl },
            layout: 'scratch_recorded/funcq',
        } } });
        if (!courseUpdate.ok) throw new Error('增加思维导图题信息失败');

        // 去除index后，为方便片段排序，重新组装片段数据
        const segmentsResult = unitUpdate.value.segments.filter(item => {
            return item.type != '评分';
        });

        const scoreItem = unitUpdate.value.segments.find(item => {
            return item.type == '评分';
        });

        // 保证评分数据不存在
        if (scoreItem) segmentsResult.push(scoreItem);

        // 更新排序后的结果
        unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $set: { segments: segmentsResult } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新排序片段信息失败');

        return { success: true, msg: '创建思维导图成功' };
    },
    // 更新思维导图片段
    async updateImPythonMindmappingSegment(parent, args, { db }, info) {
        const { unitId, courseId, segmentId, type, title, description, levelId, videoUrl } = args;

        if (type !== '思维导图') throw new Error('思维导图片段类型错误');

        const unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
            'segments.$.title': title,
            'segments.$.levelId': levelId,
            'segments.$.description': description,
            'segments.$.media': { video: videoUrl },
        } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新思维导图题片段失败');

        // 在courses表中创建对应的levels
        const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId), 'levels.segmentId': Mongodb.ObjectID(segmentId) }, { $set: {
            'levels.$.levelId': Mongodb.ObjectID(levelId),
            'levels.$.media': { video: videoUrl },
            'levels.$.name': {
                en: title,
                zh: title,
            },
        } }, { returnOriginal: false });
        if (!courseUpdate.ok) throw new Error('更新思维导图题信息失败');

        return { success: true, msg: '更新思维导图题信息成功' };
    },

    // 创建单选与多选片段
    async createImPythonChoiceSegment(parent, args, { db }, info) {
        const { unitId, courseId, type, title, description, levelId } = args;

        if (type !== '单选题' && type !== '多选题') throw new Error('选择题片段类型错误');

        const segmentId = new Mongodb.ObjectID(Date.now());
        let unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
            _id: segmentId,
            type,
            title,
            levelId,
            description,
        } } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('创建单选题或多选题片段失败');

        // 在courses表中创建对应的levels
        const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId) }, { $addToSet: { levels: {
            segmentId,
            levelId: Mongodb.ObjectID(levelId),
            name: {
                en: title,
                zh: title,
            },
            layout: 'scratch_recorded/funcq',
        } } });
        if (!courseUpdate.ok) throw new Error('增加单选题或多选题信息失败');

        // 去除index后，为方便片段排序，重新组装片段数据
        const segmentsResult = unitUpdate.value.segments.filter(item => {
            return item.type != '评分';
        });

        const scoreItem = unitUpdate.value.segments.find(item => {
            return item.type == '评分';
        });

        // 保证评分数据不存在
        if (scoreItem) segmentsResult.push(scoreItem);

        // 更新排序后的结果
        unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $set: { segments: segmentsResult } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新排序片段信息失败');

        return { success: true, msg: '创建选择题片段成功' };
    },
    // 更新单选与多选片段
    async updateImPythonChoiceSegment(parent, args, { db }, info) {
        const { unitId, courseId, segmentId, type, title, description, levelId } = args;

        if (type !== '单选题' && type !== '多选题') throw new Error('选择题片段类型错误');

        const unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
            'segments.$.title': title,
            'segments.$.levelId': levelId,
            'segments.$.description': description,
        } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新选择题片段失败');

        // 在courses表中创建对应的levels
        const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId), 'levels.segmentId': Mongodb.ObjectID(segmentId) }, { $set: {
            'levels.$.levelId': Mongodb.ObjectID(levelId),
            'levels.$.name': {
                en: title,
                zh: title,
            },
        } }, { returnOriginal: false });
        if (!courseUpdate.ok) throw new Error('更新选择题信息失败');

        return { success: true, msg: '更新选择题信息成功' };
    },

    // 创建图片片段
    async createImPythonImageSegment(parent, args, { db }, info) {
        const { unitId, courseId, type, title, description, ImgUrl } = args;

        if (type !== '图片') throw new Error('图片片段类型错误');

        // 更新单元中片段信息
        let unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
            _id: new Mongodb.ObjectID(Date.now()),
            type,
            title,
            description,
            url: ImgUrl,
        } } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('创建图片片段失败');

        // 去除index后，为方便片段排序，重新组装片段数据
        const segmentsResult = unitUpdate.value.segments.filter(item => {
            return item.type != '评分';
        });

        const scoreItem = unitUpdate.value.segments.find(item => {
            return item.type == '评分';
        });

        // 保证评分数据不存在
        if (scoreItem) segmentsResult.push(scoreItem);

        // 更新排序后的结果
        unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $set: { segments: segmentsResult } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新排序片段信息失败');

        return { success: true, msg: '创建图片片段成功' };
    },

    // 更新图片片段
    async updateImPythonImageSegment(parent, args, { db }, info) {
        const { unitId, courseId, segmentId, type, title, description, ImgUrl } = args;

        if (type !== '图片') throw new Error('图片片段类型错误');

        // 更新单元中片段信息
        const unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
            'segments.$.title': title,
            'segments.$.description': description,
            'segments.$.url': ImgUrl,
        } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新图片片段失败');

        return { success: true, msg: '更新图片片段成功' };
    },

    // 创建课件片段
    async createImPythonCoursewareSegment(parent, args, { db }, info) {
        const { unitId, courseId, type, title, description, pdfUrl } = args;

        if (type !== '课件') throw new Error('课件片段类型错误');

        // 更新单元中片段信息
        let unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
            _id: new Mongodb.ObjectID(Date.now()),
            type,
            title,
            description,
            url: pdfUrl,
        } } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('创建课件片段失败');

        // 去除index后，为方便片段排序，重新组装片段数据
        const segmentsResult = unitUpdate.value.segments.filter(item => {
            return item.type != '评分';
        });

        const scoreItem = unitUpdate.value.segments.find(item => {
            return item.type == '评分';
        });

        // 保证评分数据不存在
        if (scoreItem) segmentsResult.push(scoreItem);

        // 更新排序后的结果
        unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $set: { segments: segmentsResult } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新排序片段信息失败');

        return { success: true, msg: '创建课件片段成功' };
    },

    // 更新课件片段
    async updateImPythonCoursewareSegment(parent, args, { db }, info) {
        const { unitId, courseId, segmentId, type, title, description, pdfUrl } = args;

        if (type !== '课件') throw new Error('课件片段类型错误');

        // 更新单元中片段信息
        const unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
            'segments.$.title': title,
            'segments.$.description': description,
            'segments.$.url': pdfUrl,
        } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新课件片段失败');

        return { success: true, msg: '更新课件片段成功' };
    },

    // 创建视频片段
    async createImPythonVideoSegment(parent, args, { db }, info) {
        const { unitId, courseId, type, title, description, videoUrl, isSkipVideo } = args;

        if (type !== '视频') throw new Error('视频片段类型错误');

        // 更新单元中片段信息
        let unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
            _id: new Mongodb.ObjectID(Date.now()),
            type,
            title,
            description,
            isSkipVideo,
            url: videoUrl,
        } } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('创建视频片段失败');

        // 去除index后，为方便片段排序，重新组装片段数据
        const segmentsResult = unitUpdate.value.segments.filter(item => {
            return item.type != '评分';
        });

        const scoreItem = unitUpdate.value.segments.find(item => {
            return item.type == '评分';
        });

        // 保证评分数据不存在
        if (scoreItem) segmentsResult.push(scoreItem);

        // 更新排序后的结果
        unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $set: { segments: segmentsResult } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新排序片段信息失败');

        return { success: true, msg: '创建视频片段成功' };
    },

    // 更新视频片段
    async updateImPythonVideoSegment(parent, args, { db }, info) {
        const { unitId, courseId, segmentId, type, title, description, videoUrl, isSkipVideo } = args;

        if (type !== '视频') throw new Error('视频片段类型错误');

        // 更新单元中片段信息
        const unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
            'segments.$.title': title,
            'segments.$.description': description,
            'segments.$.url': videoUrl,
            'segments.$.isSkipVideo': isSkipVideo,
        } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新视频片段失败');

        return { success: true, msg: '更新视频片段成功' };
    },

    // 创建Python编程片段
    async createImPythonProgramSegment(parent, args, { db }, info) {
        const { unitId, courseId, type, title, description, levelId, videoUrl, projectCoverUrl, projectVideoCoverUrl } = args;

        if (type !== 'Python编程') throw new Error('Python编程片段类型错误');

        const segmentId = new Mongodb.ObjectID(Date.now());
        let unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
            _id: segmentId,
            type,
            title,
            levelId,
            description,
            media: {
                projectCover: projectCoverUrl,
                projectVideoCover: projectVideoCoverUrl,
                video: videoUrl,
            },
        } } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('创建编程片段失败');

        // 在courses表中创建对应的levels
        const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId) }, { $addToSet: { levels: {
            segmentId,
            levelId: Mongodb.ObjectID(levelId),
            name: {
                en: title,
                zh: title,
            },
            description, // 保证没有时为空串
            media: {
                projectCover: projectCoverUrl,
                projectVideoCover: projectVideoCoverUrl,
                video: videoUrl,
            },
            layout: 'scratch_recorded/funcq',
        } } });
        if (!courseUpdate.ok) throw new Error('增加编程信息失败');

        // 去除index后，为方便片段排序，重新组装片段数据
        const segmentsResult = unitUpdate.value.segments.filter(item => {
            return item.type != '评分';
        });

        const scoreItem = unitUpdate.value.segments.find(item => {
            return item.type == '评分';
        });

        // 保证评分数据不存在
        if (scoreItem) segmentsResult.push(scoreItem);

        // 更新排序后的结果
        unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $set: { segments: segmentsResult } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新排序片段信息失败');

        return { success: true, msg: '创建Python编程片段成功' };
    },

    // 更新Python编程片段
    async updateImPythonProgramSegment(parent, args, { db }, info) {
        const { unitId, courseId, segmentId, type, title, description, levelId, videoUrl, projectCoverUrl, projectVideoCoverUrl } = args;

        if (type !== 'Python编程') throw new Error('Python编程片段类型错误');

        const unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
            'segments.$.title': title,
            'segments.$.levelId': levelId,
            'segments.$.description': description,
            'segments.$.media.projectCover': projectCoverUrl,
            'segments.$.media.projectVideoCover': projectVideoCoverUrl,
            'segments.$.media.video': videoUrl,
        } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新编程片段失败');

        // 在courses表中创建对应的levels
        const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId), 'levels.segmentId': Mongodb.ObjectID(segmentId) }, { $set: {
            'levels.$.levelId': Mongodb.ObjectID(levelId),
            'levels.$.media.projectCover': projectCoverUrl,
            'levels.$.media.projectVideoCover': projectVideoCoverUrl,
            'levels.$.media.video': videoUrl,
            'levels.$.description': description,
            'levels.$.name': {
                en: title,
                zh: title,
            },
        } });
        if (!courseUpdate.ok) throw new Error('更新编程信息失败');

        return { success: true, msg: '更新Python编程片段成功' };
    },

    // 创建Python填空题
    async createImPythonCompletionSegment(parent, args, { db }, info) {
        const { unitId, courseId, type, title, description, levelId, code, demoImgUrl } = args;

        if (type !== '填空题') throw new Error('Python填空题片段类型错误');

        const segmentId = new Mongodb.ObjectID(Date.now());
        let unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $addToSet: { segments: {
            _id: segmentId,
            type,
            title,
            levelId,
            description,
            media: {
                code,
                demoImg: demoImgUrl,
            },
        } } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('创建填空题片段失败');

        // 在courses表中创建对应的levels
        const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId) }, { $addToSet: { levels: {
            segmentId,
            levelId: Mongodb.ObjectID(levelId),
            name: {
                en: title,
                zh: title,
            },
            description,
            media: {
                code,
                demoImg: demoImgUrl,
            },
            layout: 'scratch_recorded/funcq',
        } } });
        if (!courseUpdate.ok) throw new Error('增加填空题信息失败');

        // 去除index后，为方便片段排序，重新组装片段数据
        const segmentsResult = unitUpdate.value.segments.filter(item => {
            return item.type != '评分';
        });

        const scoreItem = unitUpdate.value.segments.find(item => {
            return item.type == '评分';
        });

        // 保证评分数据不存在
        if (scoreItem) segmentsResult.push(scoreItem);

        // 更新排序后的结果
        unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $set: { segments: segmentsResult } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新排序片段信息失败');

        return { success: true, msg: '创建Python填空题片段成功' };
    },

    // 更新Python填空题
    async updateImPythonCompletionSegment(parent, args, { db }, info) {
        const { unitId, courseId, segmentId, type, title, description, levelId, code, demoImgUrl } = args;
        if (type !== '填空题') throw new Error('Python填空题片段类型错误');

        const unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
            'segments.$.title': title,
            'segments.$.levelId': levelId,
            'segments.$.description': description,
            'segments.$.media.code': code,
            'segments.$.media.demoImg': demoImgUrl,
        } }, { returnOriginal: false });
        if (!unitUpdate.ok) throw new Error('更新填空题片段失败');

        // 在courses表中创建对应的levels
        const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId), 'levels.segmentId': Mongodb.ObjectID(segmentId) }, { $set: {
            'levels.$.levelId': Mongodb.ObjectID(levelId),
            'levels.$.media.code': code,
            'levels.$.media.demoImg': demoImgUrl,
            'levels.$.description': description,
            'levels.$.name': {
                en: title,
                zh: title,
            },
        } });
        if (!courseUpdate.ok) throw new Error('更新填空题信息失败');

        return { success: true, msg: '更新Python填空题片段成功' };
    },

    /* *******Python一对多结束********* */

    // 创建系列
    async createImSeries(parent, args, { db }, info) {
        const { type, name } = args;

        const seriesQuery = await db.findOne('series', { 'name.zh': name });
        if (seriesQuery) throw new Error('当前系列名称已存在');

        const seriesInsert = await db.updateOne('series', { _id: new Mongodb.ObjectID(Date.now()) }, { $set: { name: { zh: name, en: name }, type, packages: [] } }, { upsert: true, returnOriginal: false });
        if (!seriesInsert.ok || !seriesInsert.value) throw new Error('创建课程系列名称失败');

        return seriesInsert.value;
    },

    // 修改系列
    async updateImSeries(parent, args, { db }, info) {
        const { seriesId, name, type } = args;

        const seriesQuery = await db.findOne('series', { _id: Mongodb.ObjectID(seriesId) });
        if (!seriesQuery) throw new Error('当前课程系列名称不存在');

        const series = await db.updateOne('series', { _id: Mongodb.ObjectID(seriesId) }, { $set: { name: { zh: name, en: name }, type } }, { returnOriginal: false });
        if (!series.ok || !series.value) throw new Error('更新课程系列名称失败');

        return series.value;
    },

    // 向系列中填加课程包
    async addPackageToSeries(parent, args, { db }, info) {
        const { seriesId, packageIds } = args;
        let packageUpdate = null;
        for (const id of packageIds) {
            packageUpdate = await db.updateOne('series', { _id: Mongodb.ObjectID(seriesId) }, { $addToSet: { packages: Mongodb.ObjectID(id) } }, { returnOriginal: false });
            if (!packageUpdate.ok || !packageUpdate.value) continue;
        }

        return packageUpdate.value;
    },

    // 删除单元信息
    async removeImPackageUnit(parent, args, { db }, info) {
        const { packageId, unitId } = args;
        let unit = await db.findOne('units', { _id: Mongodb.ObjectID(unitId) });
        if (!unit) throw new Error('当前单元不存在');

        // 如果存在course,则删除当前单元对应的course
        if (unit.courses && Array.isArray(unit.courses)) {
            for (const courseItem of unit.courses) {
                const course = await db.deleteOne('courses', { _id: Mongodb.ObjectID(courseItem.courseId) });
                if (!course.ok) continue;
            }
        }

        // 删除单元
        unit = await db.deleteOne('units', { _id: Mongodb.ObjectID(unitId) });
        if (!unit.ok) throw new Error('删除单元信息失败');

        // 删除课程信息
        const package2 = await db.updateOne('packages', { _id: Mongodb.ObjectID(packageId) }, {
            $pull: { units: Mongodb.ObjectID(unitId) },
        }, { returnOriginal: false });
        if (!package2.ok || !package2.value) throw new Error('删除课程单元信息失败');

        return { success: true, msg: '删除单元信息成功' };
    },

    // 更新老师
    async updateTeacher(parent, args, { db, systemAdminDb }, info) {
        const { params } = args;

        const query = {};
        if (params && params.teacherId) {
            query._id = Mongodb.ObjectID(params.teacherId);
            query.roles = 'tutor';
        }

        const teacherUpdate = await db.updateOne('users', query, { $set: {
            name: params.name,
            mobile: params.mobile,
            gender: params.gender,
            tutor: {
                workState: params.workState,
                workMode: params.workMode,
                workLevel: params.workLevel,
                workAbility: parseInt(params.workAbility),
            },
        } }, { returnOriginal: false });

        if (!teacherUpdate.ok || !teacherUpdate.value) throw new Error('更新老师信息失败');

        // 对于之前非在运营管理系统所创建好的的老师,如果不存在IM账号的信息的，只需要修改一下即可
        if (!teacherUpdate.value.nim) {
            // 生成im信息
            const nim = await generateImAccount(teacherUpdate.value._id);
            if (!nim) throw new Error('生成im老师账号信息失败');
        }

        // 更新ops账号，
        // 1: 使用手机号先判断ops账号是否存在，如果不存在，则创建同名的手机号与usrId
        // 2: 如果存在，则直接更新手机号、name、userId等信息
        const opsUser = await createOpsUser({ mobile: params.mobile, name: params.name, workState: params.workState, userId: teacherUpdate.value._id, systemAdminDb });
        if (!opsUser) throw new Error('创建或更新老师对应的ops账号失败');

        return { success: true, msg: '更新老师信息成功' };
    },

    // 创建老师
    async createTeacher(parent, args, { db, systemAdminDb }, info) {
        const { params } = args;

        // 判断当前老师是否存在，如果存在，直接提示当前老师已经存在
        let teacher = await db.findOne('users', { mobile: params.mobile, roles: { $in: [ 'tutor' ] }, nim: { $exists: true } }, { projection: { mobile: true, _id: true } });
        if (teacher) {
            // 创建ops账号，
            // 1: 使用手机号先判断ops账号是否存在，如果不存在，则创建同名的手机号与usrId
            // 2: 如果存在，则直接更新
            const opsUser = await createOpsUser({ mobile: params.mobile, name: params.name, workState: params.workState, userId: teacher._id, systemAdminDb });
            if (!opsUser) throw new Error('创建或更新老师对应的ops账号失败');

            throw new Error('当前老师已经存在');
        }

        // 判断非一对多老师的情况
        teacher = await db.findOne('users', { mobile: params.mobile }, { projection: { mobile: true, roles: true, nim: true } });
        // 判断是否已经是一名学生
        if (teacher && (teacher.roles) && (teacher.roles.length === 0)) throw new Error('当前手机号的学生已经存在，不能再变为老师');
        // 判断是否是非一对多老师，如果是，则直接增加nim信息变为一对多老师
        if (teacher && (teacher.roles) && (teacher.roles.length > 0) && (!teacher.nim)) {
            teacher = await db.updateOne('users', { mobile: params.mobile }, { $set: {
                tutor: {
                    workState: params.workState,
                    workMode: params.workMode,
                    workLevel: params.workLevel,
                    workAbility: parseInt(params.workAbility),
                },
            }, $addToSet: { roles: 'tutor' } }, { returnOriginal: false });
            if (!teacher.ok || !teacher.value) throw new Error('更新老师信息失败');

            // 生成im信息
            const nim = await generateImAccount(teacher.value._id);
            if (!nim) throw new Error('生成im老师账号信息失败');

            // 创建ops账号，
            // 1: 使用手机号先判断ops账号是否存在，如果不存在，则创建同名的手机号与usrId
            // 2: 如果存在，则直接更新
            const opsUser = await createOpsUser({ mobile: params.mobile, name: params.name, workState: params.workState, userId: teacher.value._id, systemAdminDb });
            if (!opsUser) throw new Error('创建或更新老师对应的ops账号失败');

            return { success: true, msg: '创建老师信息成功' };
        }

        // 默认盐值为10, 默认密码为geekstarim
        const password = await bcrypt.hash('geekstarim', 10);
        const teacherInsert = await db.insertOne('users', {
            name: params.name,
            mobile: params.mobile,
            gender: params.gender,
            hashedPassword: password,
            roles: [ 'tutor' ], // 默认参数
            displayDate: new Date(),
            packages: [],
            tutor: {
                workState: params.workState,
                workMode: params.workMode,
                workLevel: params.workLevel,
                workAbility: parseInt(params.workAbility),
            },
        });

        if (!teacherInsert.ok) throw new Error('创建老师信息失败');

        // 生成im信息
        const users = await db.findOne('users', { mobile: params.mobile }, { _id: true });
        const nim = await generateImAccount(users._id);
        if (!nim) throw new Error('生成im老师账号信息失败');

        // 创建ops账号，
        // 1: 使用手机号先判断ops账号是否存在，如果不存在，则创建同名的手机号与usrId
        // 2: 如果存在，则直接更新
        const opsUser = await createOpsUser({ mobile: params.mobile, name: params.name, workState: params.workState, userId: users._id, systemAdminDb });
        if (!opsUser) throw new Error('创建或更新老师对应的ops账号失败');

        return { success: true, msg: '创建老师信息成功' };
    },

    // 更新备课计划--更新及创建是一个同一个方法，因为前期备课计划是不存在的
    async createReadyLessonPlan(parent, args, { db }, info) {
        const { teacherId, packageId, planList } = args;

        // 获取当前年份 -- // 0319&5e05b887a8ed8daad39e5118
        const year = moment().year();
        let planListDetial = [];
        for (const plan of planList) {
            const planObj = {};
            const planItem = plan.split('&');
            planObj[planItem[0]] = Mongodb.ObjectID(planItem[1]);
            planListDetial.push(planObj);
        }

        const readyPlanItem = await db.findOne('readylessonplan', { teacherId: Mongodb.ObjectID(teacherId), packageId: Mongodb.ObjectID(packageId), readyLessonDate: `${year}` }, { readyLessonPlan: true });
        // 更新授课计划
        if (readyPlanItem) {
            // 新的备课计划与旧的合并计划合并
            for (const item1 of planListDetial) {
                let isExists = false;
                for (const item2 of readyPlanItem.readyLessonPlan) {
                    const key1 = Object.keys(item1)[0];
                    const key2 = Object.keys(item2)[0];
                    if (key1 === key2) {
                        isExists = true;
                        item2[key1] = item1[key2];
                        break;
                    }
                }

                if (!isExists) readyPlanItem.readyLessonPlan.push(item1);
            }

            planListDetial = readyPlanItem.readyLessonPlan;
        }

        // 更新上课计划记录： 找不到创建，找到则更新
        const planUpdate = await db.updateOne('readylessonplan', { teacherId: Mongodb.ObjectID(teacherId), packageId: Mongodb.ObjectID(packageId), readyLessonDate: `${year}` }, {
            $set: { readyLessonPlan: planListDetial } },
            { upsert: true, returnOriginal: false }
        );

        if (!planUpdate.ok || !planUpdate.value) throw new Error('更新上课计划失败');

        return { success: true, msg: '更新上课成功' };
    },

    // 创建及更新授课时间
    async createTeachTime(parent, args, { db }, info) {
        const { teacherId, teachDate, teachTime, workState } = args;
        let overbookVal = 0;
        const teachTimeList = [];
        for (const teachTimeItem of teachTime) {
            const teachTimeObj = {};

            // "09:00 - 09:50"&"上课" 或者 "09:00 - 09:50"&"休息"
            teachTimeObj[teachTimeItem.split('&')[0]] = teachTimeItem.split('&')[1];
            teachTimeList.push(teachTimeObj);
        }

        // 获取之前的超限分配值，防止覆盖
        const teachlessontimeItem = await db.findOne('teachlessontime', { teacherId: Mongodb.ObjectID(teacherId), teachDate });
        teachlessontimeItem ? (overbookVal = teachlessontimeItem.overbookVal) : (overbookVal = 0);

        const result = await db.updateOne('teachlessontime', { teacherId: Mongodb.ObjectID(teacherId), teachDate }, { $set:
            { workState, overbookVal, teachTime: teachTimeList } },
            { upsert: true, returnOriginal: false }
        );

        if (!result.ok) throw new Error('创建授课时间失败');

        return { success: true, msg: '创建授课时间成功' };
    },

    // 批量修改授课时间
    async batchUpdateTeachTime(parent, args, { db }, info) {
        const { teacherId, teachDate, teachTime, workState } = args;

        const teachTimeList = [];
        for (const teachTimeItem of teachTime) {
            const teachTimeObj = {};

            // "09:00 - 09:50"&"上课" 或者 "09:00 - 09:50"&"休息"
            teachTimeObj[teachTimeItem.split('&')[0]] = teachTimeItem.split('&')[1];
            teachTimeList.push(teachTimeObj);
        }

        // 批量创建或更新授课时间
        for (const date of teachDate) {
            // 初始化授课时间
            let overbookVal = 0;

            // 获取之前的超限分配值，防止覆盖
            const teachlessontimeItem = await db.findOne('teachlessontime', { teacherId: Mongodb.ObjectID(teacherId), teachDate: date });
            teachlessontimeItem ? (overbookVal = teachlessontimeItem.overbookVal) : (overbookVal = 0);

            const result = await db.updateOne('teachlessontime', { teacherId: Mongodb.ObjectID(teacherId), teachDate: date },
            { $set:
                { workState, overbookVal, teachTime: teachTimeList } },
                { upsert: true, returnOriginal: false }
            );

            if (!result.ok) throw new Error('更新授课时间失败');
        }

        return { success: true, msg: '批量更新授课时间成功' };
    },

    // 排序单元数据
    async sortedImUnit(parent, args, { db }, info) {
        let { packageId, unitIdList } = args;

        // 加一层判断，防止空数组赋值，其实参数已经加了必选控制
        if (unitIdList && Array.isArray(unitIdList) && (unitIdList.length === 0)) throw new Error('排序列表为空');

        unitIdList = unitIdList.map(id => {
            return Mongodb.ObjectID(id);
        });

        const updatePackage = await db.updateOne('packages', { _id: Mongodb.ObjectID(packageId) }, { $set: {
            units: unitIdList,
        } }, { returnOriginal: false });

        if (!updatePackage.ok || !updatePackage.value) throw new Error('更新课程信息失败');

        return { success: true, msg: '更新单元排序成功' };
    },

    // 排序片段数据
    async sortedImUnitSegment(parent, args, { db }, info) {
        const { unitId, segmentIdList } = args;

        // 加一层判断，防止空数组赋值，其实参数已经加了必选控制
        if (segmentIdList && Array.isArray(segmentIdList) && (segmentIdList.length === 0)) throw new Error('排序列表为空');

        const sortedSegments = [];
        const unit = await db.findOne('units', { _id: Mongodb.ObjectID(unitId) }, { segments: true, _id: false });
        if (!unit) throw new Error('单元信息未找到');
        if (unit.segments && (unit.segments.length === 0)) throw new Error('当前片段信息为空');

        for (const id of segmentIdList) {
            const item = unit.segments.find(item => {
                return (item._id).toString() === id.toString();
            });

            // 更新主键ID
            if (!item) continue;
            item._id = Mongodb.ObjectID(id);
            sortedSegments.push(item);
        }

        const updateSegment = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId) }, { $set: {
            segments: sortedSegments,
        } }, { returnOriginal: false });

        if (!updateSegment.ok || !updateSegment.value) throw new Error('更新片段信息失败');

        return { success: true, msg: '更新片段排序成功' };
    },

    // 排序习题闯关数据
    async sortedImUnitQuiz(parent, args, { db }, info) {
        const { courseId, quizIdList } = args;

        // 加一层判断，防止空数组赋值，其实参数已经加了必选控制
        if (quizIdList && Array.isArray(quizIdList) && (quizIdList.length === 0)) throw new Error('排序列表为空');

        const sortedQuizs = [];
        const course = await db.findOne('courses', { _id: Mongodb.ObjectID(courseId) }, { levels: true, _id: false });
        if (!course) throw new Error('习题闯关信息未找到');
        if (course.levels && (course.levels.length === 0)) throw new Error('当前习题闯关为空，不能排序');

        for (const id of quizIdList) {
            const item = course.levels.find(item => {
                return (item.levelId).toString() === id.toString();
            });

            // 更新主键ID
            if (!item) continue;
            item.levelId = Mongodb.ObjectID(id);
            sortedQuizs.push(item);
        }

        const updateQuiz = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId) }, { $set: {
            levels: sortedQuizs,
        } }, { returnOriginal: false });

        if (!updateQuiz.ok || !updateQuiz.value) throw new Error('更新习题闯关信息失败');

        return { success: true, msg: '更新习题闯关排序成功' };
    },

    // 修改老师，也就是重新分配老师
    async updateReservation(parent, args, { db }, info) {
        const { reservationId, teacherId } = args;

        // 判断当前的预约状态，如果是进行中，则禁止修改老师
        const reservation = await db.findOne('reservations', { _id: Mongodb.ObjectID(reservationId) }, { projection: { tracked: true, start: true, end: true } });
        if (!reservation) throw new Error('当前预约已不存在');

        if ((reservation.tracked.state === 'in-progress') && (moment().isBefore(moment(reservation.end))) && (moment().isAfter(moment(reservation.start)))) throw new Error('当前预约正在进行中，不能进行修改老师');

        const result = await updateReservationTeacher(reservationId, teacherId);
        if (!result) throw new Error('调整预约记录老师失败');

        return { success: true, msg: '调整预约记录老师成功' };
    },

    // 设置超限分配的值
    async setOverbookVal(parent, args, { db }, info) {
        // teacherId与teachDate表示每个老师每天的授课计划，是唯一的
        const { teacherId, teachDate, overbookVal } = args;

        const teachTimeItem = await db.findOne('teachlessontime', { teacherId: Mongodb.ObjectID(teacherId), teachDate });
        if (teachTimeItem) {
            await db.updateOne('teachlessontime', { teacherId: Mongodb.ObjectID(teacherId), teachDate }, { $set: { overbookVal } });
        } else {
            // 如果不存在授课时间，则默认将全部授课时间设置为上课
            await db.insertOne('teachlessontime', {
                teacherId: Mongodb.ObjectID(teacherId),
                workState: '正常',
                teachDate,
                overbookVal,
                teachTime: [
                    { '09:00 - 09:50': '上课' },
                    { '09:50 - 10:40': '上课' },
                    { '10:40 - 11:30': '上课' },
                    { '11:30 - 12:20': '上课' },
                    { '12:20 - 13:10': '上课' },
                    { '13:10 - 14:00': '上课' },
                    { '14:00 - 14:50': '上课' },
                    { '14:50 - 15:40': '上课' },
                    { '15:40 - 16:30': '上课' },
                    { '16:30 - 17:20': '上课' },
                    { '17:20 - 18:10': '上课' },
                    { '18:10 - 19:00': '上课' },
                    { '19:00 - 19:50': '上课' },
                    { '19:50 - 20:40': '上课' },
                  ],
            });
        }

        return { teacherId, overbookVal };
    },

    // 超限分配老师
    async overbookAllocated(parent, args, { db }, info) {
        const { reservationIds, teacherId } = args;
        for (const reservationId of reservationIds) {
            const result = await updateReservationTeacher(reservationId, teacherId);
            if (!result) throw new Error('调整超限分配失败');
        }

        return { success: true, msg: '超限分配成功' };
    },

    // 创建售卖产品
    async createImProducts(parent, args, { db, pay2Db, systemAdminDb }, info) {
        let {
            type, // "normal", "incremental"
            price,
            trial,
            enabled,
            productName,
            packageId,
            startUnitIndex,
            classes,
            freeClasses,
            users, // 填写用户手机号，后台通过手机号转成用户ID,待和生哥确定
            saleStartDate,
            saleEndDate,
            descriptions,
            saleList,
        } = args.params;

        // 判断当前产品是否存在
        const productRet = await pay2Db.findOne('products', { name: productName }, { projection: { name: true } });
        if (productRet) throw new Error('当前产品已存在');

        // 判断课时与是否超量
        const totalClasses = freeClasses + classes;
        const packageItem = await db.findOne('packages', { _id: Mongodb.ObjectID(packageId) }, { projection: { classPerUnit: true, totalUnits: true, tag: true } });
        if (!packageItem) throw new Error('所选课程信息不存在');
        if (totalClasses > (packageItem.totalUnits * packageItem.classPerUnit)) throw new Error('当前输入课时数大于课程的总课时数');

        // 过滤掉所有禁用且未初始的状态的销售或班主任
        const tempSaleList = [];
        for (const saleId of saleList) {
            const systemUser = await systemAdminDb.findOne('system_users', { _id: Mongodb.ObjectID(saleId), isOn: 1, isReset: 1 }, { projection: { name: true } });
            if (systemUser) tempSaleList.push(saleId);
        }
        saleList = tempSaleList;

        console.log('config[process.env.CONFIG] = ', config[process.env.CONFIG]);
        console.log('config[process.env.CONFIG].trial = ', config[process.env.CONFIG].trial);
        console.log('config[process.env.CONFIG].formal = ', config[process.env.CONFIG].formal);

        // 获取产品分类ID
        const path = trial ? config[process.env.CONFIG].trial : config[process.env.CONFIG].formal;
        const productCategory = await pay2Db.findOne('productcategories', { path }, { projection: { _id: true } });

        console.log('productCategory = ', productCategory, 'path = ', path);
        if (!productCategory) throw new Error('产品分类信息不存在');

        const saleIdList = saleList.map(id => {
            return Mongodb.ObjectID(id);
        });

        const productObj = {
            trial,
            enabled,
            name: productName,
            v1: {
                Class: `互动${productName}`,
                Courseid: packageItem.tag,
            },
            price: {
                nominal: price,
            },
            productCategoryId: Mongodb.ObjectID(productCategory._id),
            descriptions: [ descriptions ],
            saleStartDate: moment(Number(saleStartDate)).toDate(),
            saleEndDate: saleEndDate ? moment(Number(saleEndDate)).toDate() : null,
            startDate: moment(Number(saleStartDate)).toDate(),
            endDate: moment(Number(saleStartDate)).toDate(),
            _tag: packageItem.tag,
        };

        // 根据课程类型，区分是销售还是班主任
        if (trial) {
            productObj.sales = saleIdList;
        } else {
            productObj.classmanagers = saleIdList;
        }

        if (process.env.CONFIG === 'staging') {
            // productObj[config[process.env.CONFIG].imEnv] =
            productObj['im-stage'] = {
                packageId: Mongodb.ObjectID(packageId),
                type: ((type === 'normal') ? 'partial' : 'incremental'),
                ... ((type === 'normal') ? { startUnitIndex } : null),
                classes,
                freeClasses,
                users,
            };
        } else if (process.env.CONFIG === 'test') {
            productObj['im-test'] = {
                packageId: Mongodb.ObjectID(packageId),
                type: ((type === 'normal') ? 'partial' : 'incremental'),
                ... ((type === 'normal') ? { startUnitIndex } : null),
                classes,
                freeClasses,
                users,
            };
        } else {
            productObj.im = {
                packageId: Mongodb.ObjectID(packageId),
                type: ((type === 'normal') ? 'partial' : 'incremental'),
                ... ((type === 'normal') ? { startUnitIndex } : null),
                classes,
                freeClasses,
                users,
            };
        }

        const product = await pay2Db.insertOne('products', productObj);
        if (!product.ok) throw new Error('生成产品信息失败');

        return { success: true, msg: '创建产品成功' };
    },

    // 更新售卖产品
    async updateImProducts(parent, args, { db, pay2Db, systemAdminDb }, info) {
        let {
            type,
            productId,
            price,
            trial,
            enabled,
            productName,
            packageId,
            startUnitIndex,
            classes,
            freeClasses,
            users, // 填写用户手机号，后台通过手机号转成用户ID,待和生哥确定
            saleStartDate,
            saleEndDate,
            descriptions,
            saleList,
        } = args.params;

        // 判断课时与是否超量
        const totalClasses = freeClasses + classes;
        const packageItem = await db.findOne('packages', { _id: Mongodb.ObjectID(packageId) }, { projection: { classPerUnit: true, totalUnits: true, tag: true } });
        if (!packageItem) throw new Error('所选课程信息不存在');
        if (totalClasses > (packageItem.totalUnits * packageItem.classPerUnit)) throw new Error('当前输入课时数大于课程的总课时数');

        // 过滤掉所有禁用且未初始的状态的销售或班主任
        const tempSaleList = [];
        for (const saleId of saleList) {
            const systemUser = await systemAdminDb.findOne('system_users', { _id: Mongodb.ObjectID(saleId), isOn: 1, isReset: 1 }, { projection: { name: true } });
            if (systemUser) tempSaleList.push(saleId);
        }
        saleList = tempSaleList;

        // 获取产品分类ID
        const path = trial ? config[process.env.CONFIG].trial : config[process.env.CONFIG].formal;
        const productCategory = await pay2Db.findOne('productcategories', { path }, { _id: true });
        if (!productCategory) throw new Error('产品分类信息不存在');

        const saleIdList = saleList.map(id => {
            return Mongodb.ObjectID(id);
        });

        const productObj = {
            trial,
            enabled,
            name: productName,
            v1: {
                Class: `互动${productName}`,
                Courseid: packageItem.tag,
            },
            price: {
                nominal: price,
            },
            productCategoryId: Mongodb.ObjectID(productCategory._id),
            descriptions: [ (descriptions ? descriptions : '') ],
            saleStartDate: moment(Number(saleStartDate)).toDate(),
            saleEndDate: saleEndDate ? moment(Number(saleEndDate)).toDate() : null,
            startDate: moment(Number(saleStartDate)).toDate(),
            endDate: moment(Number(saleStartDate)).toDate(),
            _tag: packageItem.tag,
        };

        // 根据课程类型，区分是销售还是班主任
        if (trial) {
            productObj.sales = saleIdList;
        } else {
            productObj.classmanagers = saleIdList;
        }

        if (process.env.CONFIG === 'staging') {
            productObj['im-stage'] = {
                packageId: Mongodb.ObjectID(packageId),
                type: ((type === 'normal') ? 'partial' : 'incremental'),
                ... ((type === 'normal') ? { startUnitIndex } : null),
                classes,
                freeClasses,
                users,
            };
        } else if (process.env.CONFIG === 'test') {
            productObj['im-test'] = {
                packageId: Mongodb.ObjectID(packageId),
                type: ((type === 'normal') ? 'partial' : 'incremental'),
                ... ((type === 'normal') ? { startUnitIndex } : null),
                classes,
                freeClasses,
                users,
            };
        } else {
            productObj.im = {
                packageId: Mongodb.ObjectID(packageId),
                type: ((type === 'normal') ? 'partial' : 'incremental'),
                ... ((type === 'normal') ? { startUnitIndex } : null),
                classes,
                freeClasses,
                users,
            };
        }

        const product = await pay2Db.updateOne('products', { _id: Mongodb.ObjectID(productId) }, { $set: productObj });
        if (!product.ok || !product.value) throw new Error('更新产品信息失败');

        return { success: true, msg: '更新产品成功' };
    },


    // 创建试听课账号
    async creatTrialAccount(parent1, args, { db, pay2Db }, info) {
        const {
            mobile,
            name,
            grade,
            gender,
            parent,
            city,
            age,
            remark,
            isTest,
        } = args.params;

        // 前端已经屏蔽一对多学生，目前只剩下:
        const query = { mobile, nim: { $exists: false } };
        const user = await db.findOne('users', query, { projection: { mobile: true, nim: true, roles: true, _id: true } });
        // 如果手机号存在，则说明是三无账号
        if (user) {
            // 是一个对多的学生
            const updateResult = await db.updateOne('users', { mobile }, { $set: {
                name,
                gender,
                grade,
                parent,
                city,
                remark,
                age,
                roles: [],
                isTest,
            } }, { returnOriginal: false });
            if (!updateResult.ok || !updateResult.value) throw new Error('更新试听课学生失败');

            // 生成im信息
            const nim = await generateImAccount(updateResult.value._id);
            if (!nim) throw new Error('生成im老师账号信息失败');
        } else { // 表示当前学生根本不存在
            /*
            // 默认盐值为10, 默认密码为 geekstarim
            let password = await bcrypt.hash("geekstarim", 10);
            */
            const hashedPassword = await bcrypt.hash(mobile.substring(mobile.length - 6), 10);
            const userInsertRet = await db.insertOne('users', {
                mobile,
                hashedPassword,
                name,
                grade,
                gender,
                parent,
                city,
                age,
                remark,
                packages: [],
                roles: [],
                displayDate: new Date(),
                isTest,
            });
            if (!userInsertRet.ok) throw new Error('插入学生信息失败!');

            // 为保险起见，再查询一次，其实可以写成一个findOneAndUpdate
            const userQueryRet = await db.findOne('users', { mobile }, { projection: { _id: true } });
            if (!userQueryRet) throw new Error('当前学生不存在');
            // 生成im信息
            const nim = await generateImAccount(userQueryRet._id);
            if (!nim) throw new Error('生成im老师账号信息失败');
        }

        return { success: true, msg: '创建试听账号成功' };
    },

    // 绑定试听课
    async bindTrialPackage(parent1, args, { db, pay2Db }, info) {
        const {
            mobile,
            salesOpsId,
            productId,
        } = args.params;

        const user = await db.findOne('users', { mobile }, { projection: { _id: true, name: true, gender: true, parent: true, city: true, remark: true, age: true } });
        if (!user) throw new Error('当前学生不存在');

        // 判断当前学生是否已经绑定当前产品(试听课程)
        // 1、根据产品ID得到物理课程包
        const filedFilter = { _id: true };
        filedFilter[config[process.env.CONFIG].imEnv] = true;

        const productItem = await pay2Db.findOne('products', { _id: Mongodb.ObjectID(productId) }, { projection: filedFilter });
        if (!productItem) throw new Error('当前产品不存在');

        // 判断课程是否生效
        const packageItem = await db.findOne('packages', { _id: Mongodb.ObjectID(productItem[config[process.env.CONFIG].imEnv].packageId) }, { projection: { openTime: true, _id: true } });
        if (!packageItem) throw new Error('当前产品所绑定的课程不存在');
        // if(packageItem && packageItem.openTime && (moment().isBefore(moment(Number(packageItem.openTime))))) throw new Error("当前课程还未开放");

        // 生成im信息及绑定课程
        const trialAccountResult = await creatTrialAccount({
            mobile,
            name: user.name,
            gender: user.gender,
            parent: user.parent,
            city: user.city,
            remark: user.remark,
            age: user.age,
            salesOpsId,
            productId,
        });
        if (!trialAccountResult) throw new Error('绑定试听课失败');

        return { success: true, msg: '绑定试听课成功' };
    },

    // 绑定正式课
    async bindFormalPackage(parent1, args, { db, pay2Db }, info) {
        const {
            mobile,
            salesOpsId,
            productId,
        } = args.params;

        const user = await db.findOne('users', { mobile }, { projection: { _id: true, name: true, gender: true, parent: true, city: true, remark: true, age: true } });
        if (!user) throw new Error('当前学生不存在');

        // 1、根据产品ID得到物理课程包
        const filedFilter = { _id: true };
        filedFilter[config[process.env.CONFIG].imEnv] = true;

        const productItem = await pay2Db.findOne('products', { _id: Mongodb.ObjectID(productId) }, { projection: filedFilter });
        if (!productItem) throw new Error('当前产品不存在');

        // 判断课程是否生效
        const packageItem = await db.findOne('packages', { _id: Mongodb.ObjectID(productItem[config[process.env.CONFIG].imEnv].packageId) }, { projection: { openTime: true, _id: true } });
        if (!packageItem) throw new Error('当前产品所绑定的课程不存在');
        // if(packageItem && packageItem.openTime && (moment().isBefore(moment(Number(packageItem.openTime))))) throw new Error("当前课程还未开放");

        // 生成im信息及绑定课程
        const formalAccountResult = await creatTrialAccount({
            mobile,
            name: user.name,
            gender: user.gender,
            parent: user.parent,
            city: user.city,
            remark: user.remark,
            age: user.age,
            salesOpsId,
            productId,
        });
        if (!formalAccountResult) throw new Error('绑定正式课失败');

        return { success: true, msg: '绑定正式课成功' };
    },

    // 创建预约
    async createPackageReservation(parent, args, { db, pay2Db }, info) {
        const { studentId, packageId, date, desc } = args;
        const allowOverbook = 'true';
        const reservationRet = await createReservation(studentId, packageId, date, desc, allowOverbook);
        if (!reservationRet) throw new Error('创建预约失败');

        return { success: true, msg: '创建预约成功' };

    },

    // 修改预约
    async changeReservation(parent, args, { db, pay2Db }, info) {
        const { reservationId, date, desc } = args;

        // 判断当前的预约状态，如果是进行中，则禁止预约
        const reservation = await db.findOne('reservations', { _id: Mongodb.ObjectID(reservationId) }, { projection: { tracked: true, start: true, end: true } });
        if (!reservation) throw new Error('当前预约已不存在');

        if ((reservation.tracked.state === 'in-progress') && (moment().isBefore(moment(reservation.end))) && (moment().isAfter(moment(reservation.start)))) throw new Error('当前预约正在进行中，不能进行改期');

        const reservationResult = await changeReservation(reservationId, date, desc);
        if (!reservationResult) throw new Error('改期失败');

        return { success: true, msg: '预约改期成功' };
    },

    // 取消预约
    async cancelReservation(parent, args, { db, pay2Db }, info) {
        const { reservationId } = args;

        // 判断当前的预约状态，如果是进行中，则禁止预约
        const reservation = await db.findOne('reservations', { _id: Mongodb.ObjectID(reservationId) }, { projection: { tracked: true, start: true, end: true } });
        if (!reservation) throw new Error('当前预约已不存在');

        if ((reservation.tracked.state === 'in-progress') && (moment().isBefore(moment(reservation.end))) && (moment().isAfter(moment(reservation.start)))) throw new Error('当前预约正在进行中，不能进行取消');

        const reservationResult = await cancelReservation(reservationId);
        if (!reservationResult) throw new Error('改期失败');

        return { success: true, msg: '取消预约成功' };
    },

    // 更新学生
    async updateTrialAccount(parent1, args, { db, pay2Db }, info) {
        const {
            userId,
            mobile,
            name,
            gender,
            grade,
            parent,
            city,
            age,
            remark,
            isTest,
        } = args.params;

        const user = await db.updateOne('users', { _id: Mongodb.ObjectID(userId) }, { $set: {
            mobile,
            name,
            grade,
            gender,
            parent,
            city,
            age,
            remark,
            isTest,
        } }, { returnOriginal: false });

        if (!user.ok || !user.value) throw new Error('更新试听课用户信息失败');

        // 为防止学生生成im账号失败，在学生编辑列表里增加绑定nim账号流程
        /* if(!user.value.nim){
            // 生成im信息
            let nim = await generateImAccount(user.value._id);
            if(!nim) throw new Error("生成im老师账号信息失败");
        } */

        return { success: true, msg: '更新试听课用户信息成功' };
    },

    // 根据编程片段ID生成课后挑战
    async createChallengeByProgram(parent1, args, { db, pay2Db }, info) {
        const { unitId, segmentId, type } = args;

        if (type === '编程') {
            let programSegmentItem = null;
            const unit = await db.findOne('units', { _id: Mongodb.ObjectID(unitId) }, { projection: { segments: true, courses: true } });
            if (!unit) throw new Error('编程片段所在单元信息不存在');
            for (const segment of unit.segments) {
                if ((segment._id.toString() == segmentId.toString()) && (segment.type == '编程')) {
                    programSegmentItem = segment;
                    break;
                }
            }

            if (!programSegmentItem) throw new Error('当前编程片段信息不存在');

            // 获取courseId
            const challengeItem = unit.courses.find(item => {
                return item.type === 'challenge';
            });
            if (!challengeItem) throw new Error('当前单元不存在课后挑战');

            const unitQuery = await db.findOne('courses', { _id: Mongodb.ObjectID(challengeItem.courseId) });
            if (!unitQuery) throw new Error('当前课后挑战的courseId不存在');

            // 创建课后挑战数据结构
            const challengeObj = {
                tag: `${uid()}${Date.now()}`,
                levelId: Mongodb.ObjectID(programSegmentItem.levelId),
                name: {
                    en: programSegmentItem.title,
                    zh: programSegmentItem.title,
                },
                media: {
                    sb3: programSegmentItem.media.sb3,
                    solutionSb3: programSegmentItem.media.solutionSb3,
                    projectCover: programSegmentItem.media.projectCover,
                    video: programSegmentItem.media.video,
                },
                description: programSegmentItem.description,
                layout: 'app_layout',
            };

            // 获取习题闯关与课后挑战的主键ID
            const challengeCourseResult = await db.updateOne('courses', { _id: Mongodb.ObjectID(challengeItem.courseId) }, { $addToSet: { levels: challengeObj } }, { returnOriginal: false });
            if (!challengeCourseResult.ok || !challengeCourseResult.value) throw new Error('更新课后挑战课程信息失败');

            return challengeCourseResult.value;
        }

        if (type === 'Python编程') {
            let programSegmentItem = null;
            const unit = await db.findOne('units', { _id: Mongodb.ObjectID(unitId) }, { projection: { segments: true, courses: true } });
            if (!unit) throw new Error('编程片段所在单元信息不存在');
            for (const segment of unit.segments) {
                if ((segment._id.toString() == segmentId.toString()) && (segment.type == 'Python编程')) {
                    programSegmentItem = segment;
                    break;
                }
            }

            if (!programSegmentItem) throw new Error('当前编程片段信息不存在');

            // 获取courseId
            const challengeItem = unit.courses.find(item => {
                return item.type === 'challenge';
            });
            if (!challengeItem) throw new Error('当前单元不存在课后挑战');

            const unitQuery = await db.findOne('courses', { _id: Mongodb.ObjectID(challengeItem.courseId) });
            if (!unitQuery) throw new Error('当前课后挑战的courseId不存在');

            // 创建课后挑战数据结构
            const challengeObj = {
                tag: `${uid()}${Date.now()}`,
                levelId: Mongodb.ObjectID(programSegmentItem.levelId),
                name: {
                    en: programSegmentItem.title,
                    zh: programSegmentItem.title,
                },
                media: {
                    projectCover: programSegmentItem.media.projectCover,
                    projectVideoCover: programSegmentItem.media.projectVideoCover,
                    video: programSegmentItem.media.video,
                },
                description: programSegmentItem.description,
                layout: 'app_layout',
            };

            const challengeCourseResult = await db.updateOne('courses', { _id: Mongodb.ObjectID(challengeItem.courseId) }, { $addToSet: { levels: challengeObj } }, { returnOriginal: false });
            if (!challengeCourseResult.ok || !challengeCourseResult.value) throw new Error('更新课后挑战课程信息失败');

            return challengeCourseResult.value;
        }
    },

    // 删除课后挑战
    async removeImChallenge(parent, args, { db }, info) {
        const { courseId, tag } = args;

        const challengeItem = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId) }, { $pull: { levels: { tag } } }, { returnOriginal: false });
        if (!challengeItem.ok) throw new Error('删除课后挑战失败');

        return { success: true, msg: '删除课后挑战成功' };
    },

    // 只有删除预约，学生端与后端才能重新预约
    async removeReservation(parent1, args, { db, pay2Db }, info) {
        const { reservationId } = args;

        const reservation = await db.deleteOne('reservations', { _id: Mongodb.ObjectID(reservationId) });
        if (!reservation.ok) throw new Error('清除预约记录失败');

        return { success: true, msg: '清除预约记录成功' };
    },

    // 补发点评
    // 发送反馈报告, ["课堂表现|5", "作业情况|5", "知识掌握|5"]
    async sendFeedback(parent1, args, { db, pay2Db }, info) {
        const { reservationId, score, text } = args;
        const scoreList = score.map(item => {
            const desc = item.split('|')[0];
            const starVal = parseInt(item.split('|')[1]);
            return [ desc, starVal ];
        });

        const reservationItem = await db.updateOne('reservations', { _id: Mongodb.ObjectID(reservationId) }, { $set: {
            'tracked.extendedState.teacher_grade': {
                score: scoreList,
                text,
            },
            'tracked.state': 'completed',
        } }, { returnOriginal: false });

        if (!reservationItem.ok || !reservationItem.value) throw new Error('更新评级报告失败');

        const result = await sendFeedback(reservationId);
        if (!result) throw new Error('发送微信模板消息失败');

        return { success: true, msg: '发送评级模板消息成功' };
    },

    // 增加或更新编辑片段引导
    async createProgramGuide(parent1, args, { db, pay2Db }, info) {
       let { unitId, courseId, segmentId, guides } = args;

        // 如果指引不存在，则默认置空，方便前端处理
        if (!guides) guides = [];

        const unitUpdate = await db.updateOne('units', { _id: Mongodb.ObjectID(unitId), 'segments._id': Mongodb.ObjectID(segmentId) }, { $set: {
            'segments.$.media.guides': guides,
        } }, { returnOriginal: false });
        if (!unitUpdate.ok || !unitUpdate.value) throw new Error('更新编程片段引导信息失败');

        const courseUpdate = await db.updateOne('courses', { _id: Mongodb.ObjectID(courseId), 'levels.segmentId': Mongodb.ObjectID(segmentId) }, { $set: {
            'levels.$.media.guides': guides,
        } });
        if (!courseUpdate.ok || !courseUpdate.value) throw new Error('更新编程片段引导信息失败');

        return { success: true, msg: '增加编程片段引导信息成功' };
    },

    // 创建语音课程包
    async createVoicePackage(parent, args, { db, systemAdminDb }, info) {
        const { packageId, unitId, segmentId, voicePackage } = args;

        console.log('createVoicePackage parent = ', parent);

        // 防止非一对多教师角色查看，因为这里是根据具体角色查看具体信息的
        const role = parent.role.find(item => {
            return item === '一对多教师';
        });
        if (!role) throw new Error('当前用户不是一对多教师角色');

        const opsUser = await systemAdminDb.findOne('system_users', { _id: Mongodb.ObjectID(parent._id) }, { projection: { userId: true } });
        if (!opsUser || (!opsUser.userId)) throw new Error('当前一对多教师不存在');
        const teacherId = opsUser.userId;

        console.log('createVoicePackage teacherId = ', teacherId);

        voicePackage._id = new Mongodb.ObjectID(Date.now());
        const voicePackageItem = await db.updateOne('voicePackages', {
            packageId: Mongodb.ObjectID(packageId),
            unitId: Mongodb.ObjectID(unitId),
            segmentId: Mongodb.ObjectID(segmentId),
            teacherId: Mongodb.ObjectID(teacherId),
        },
        {
            $push: { voicePackages: voicePackage },
        }, { upsert: true, returnOriginal: false });
        if (!voicePackageItem.ok || !voicePackageItem.value) throw new Error('创建语音包失败');

        return { success: true, msg: '创建语音包成功' };
    },

    // 更新语音课程包
    async updateVoicePackage(parent, args, { db, systemAdminDb }, info) {
        const { packageId, unitId, segmentId, voicePackageId, voicePackage } = args;

        console.log('updateVoicePackage parent = ', parent);

        // 防止非一对多教师角色查看，因为这里是根据具体角色查看具体信息的
        const role = parent.role.find(item => {
            return item === '一对多教师';
        });
        if (!role) throw new Error('当前用户不是一对多教师角色');

        const opsUser = await systemAdminDb.findOne('system_users', { _id: Mongodb.ObjectID(parent._id) }, { projection: { userId: true } });
        if (!opsUser || (!opsUser.userId)) throw new Error('当前一对多教师不存在');
        const teacherId = opsUser.userId;

        console.log('updateVoicePackage teacherId = ', teacherId);

        const voicePackageItem = await db.updateOne('voicePackages', {
            packageId: Mongodb.ObjectID(packageId),
            unitId: Mongodb.ObjectID(unitId),
            segmentId: Mongodb.ObjectID(segmentId),
            teacherId: Mongodb.ObjectID(teacherId),
            'voicePackages._id': Mongodb.ObjectID(voicePackageId),
        },
        {
           $set: {
            'voicePackages.$.duration': voicePackage.duration,
            'voicePackages.$.description': voicePackage.description,
            'voicePackages.$.url': voicePackage.url,
           },
        }, { upsert: true, returnOriginal: false });
        if (!voicePackageItem.ok || !voicePackageItem.value) throw new Error('更新语音包失败');

        return { success: true, msg: '更新语音包成功' };
    },

    // 删除语音课程包
    async deleteVoicePackage(parent, args, { db, systemAdminDb }, info) {
        const { packageId, unitId, segmentId, voicePackageId } = args;

        console.log('deleteVoicePackage parent = ', parent);

        // 防止非一对多教师角色查看，因为这里是根据具体角色查看具体信息的
        const role = parent.role.find(item => {
            return item === '一对多教师';
        });
        if (!role) throw new Error('当前用户不是一对多教师角色');

        const opsUser = await systemAdminDb.findOne('system_users', { _id: Mongodb.ObjectID(parent._id) }, { projection: { userId: true } });
        if (!opsUser || (!opsUser.userId)) throw new Error('当前一对多教师不存在');
        const teacherId = opsUser.userId;

        console.log('deleteVoicePackage teacherId = ', teacherId);

        const voicePackageItem = await db.updateOne('voicePackages', {
            packageId: Mongodb.ObjectID(packageId),
            unitId: Mongodb.ObjectID(unitId),
            segmentId: Mongodb.ObjectID(segmentId),
            teacherId: Mongodb.ObjectID(teacherId),
            'voicePackages._id': Mongodb.ObjectID(voicePackageId),
        },
        {
           $pull: { voicePackages: { _id: Mongodb.ObjectID(voicePackageId) } },
        }, { returnOriginal: false });
        if (!voicePackageItem.ok || !voicePackageItem.value) throw new Error('删除语音包失败');

        return { success: true, msg: '删除语音包成功' };
    },

    //  排序某个片段的语音包
    async sortedVoicePackage(parent, args, { db, systemAdminDb }, info) {
        const { packageId, unitId, segmentId, voicePackageIds } = args;

        console.log('sortedVoicePackage parent = ', parent);

        // 防止非一对多教师角色查看，因为这里是根据具体角色查看具体信息的
        const role = parent.role.find(item => {
            return item === '一对多教师';
        });
        if (!role) throw new Error('当前用户不是一对多教师角色');

        const opsUser = await systemAdminDb.findOne('system_users', { _id: Mongodb.ObjectID(parent._id) }, { projection: { userId: true } });
        if (!opsUser || (!opsUser.userId)) throw new Error('当前一对多教师不存在');
        const teacherId = opsUser.userId;
        console.log('sortedVoicePackage teacherId = ', teacherId);

        let voicePackageItem = await db.findOne('voicePackages', {
            packageId: Mongodb.ObjectID(packageId),
            unitId: Mongodb.ObjectID(unitId),
            segmentId: Mongodb.ObjectID(segmentId),
            teacherId: Mongodb.ObjectID(teacherId),
        });
        if (!voicePackageItem) throw new Error('当前单元的语音信息不存在');

        const sortedVoicePackage = [];
        for (const id of voicePackageIds) {
            const item = voicePackageItem.voicePackages.find(item => {
                return (item._id).toString() === id.toString();
            });

            // 更新主键ID
            if (!item) continue;
            item._id = Mongodb.ObjectID(id);
            sortedVoicePackage.push(item);
        }

        voicePackageItem = await db.updateOne('voicePackages', {
            packageId: Mongodb.ObjectID(packageId),
            unitId: Mongodb.ObjectID(unitId),
            segmentId: Mongodb.ObjectID(segmentId),
            teacherId: Mongodb.ObjectID(teacherId),
        }, {
            $set: {
                voicePackages: sortedVoicePackage,
            },
        });
        if (!voicePackageItem.ok || !voicePackageItem.value) throw new Error('语音包排序失败');

        return { success: true, msg: '语音包排序成功' };
    },

    // 设置演练实践老师
    async setPracticeTeacher(parent, args, { db }, info) {
        const { userId, teacherId } = args;
        const userItem = await db.updateOne('users', { _id: Mongodb.ObjectID(userId) }, { $set: {
            rehearsal: { teacherId: Mongodb.ObjectID(teacherId) },
        } });
        if (!userItem.ok || !userItem.value) throw new Error('设置学生实践老师失败');

        return { success: true, msg: '设置学生实践老师成功' };
    },
    /**
     * mutation{
        updateDualPackage(dPackageID:"5ef993241f240f069b9db4cf",name:"hai"){
            success,msg
            }
        }
     */
    async insertDualPackage(parent, args, { dualteacherDb }, info) {
        const { params } = args;
        params.name = {
            en: params.name,
            zh: params.name,
        };
        params.units = [];
        params.type = 'dualTeacher';
        params.contentType = 'Python双师';
        params.totalUnits = 0;
        params.createTime = new Date();
        params.updateTime = new Date();
        await dualteacherDb.insertOne('dualpackages', { ...params });
        return { success: true, msg: 'insert' + JSON.stringify(params) + '成功' };
    },
    async updateDualPackage(parent, args, { dualteacherDb }, info) {
        const { params } = args;
        if (params.name) {
            params.name = {
                en: params.name,
                zh: params.name,
            };
        }
        const res = await dualteacherDb.updateOne('dualpackages', { _id: Mongodb.ObjectID(args._id) }, { $set: {
            ...params,
        } });
        return { success: true, msg: '更新' + args._id + '成功,mongore:', res };
    },
    async insertDualUnit(parent, args, { dualteacherDb }, info) {
        const { params, _id } = args;
        params.type = 'dualTeacher';
        const segmentId = Mongodb.ObjectId();
        const quizId = Mongodb.ObjectId();
        const challengeId = Mongodb.ObjectId();
        params.name = {
            en: params.name,
            zh: params.name,
        };
        params.segments = [];
        params.courses = [
            { type: 'segment', segmentId },
            { type: 'quiz', quizId },
            { type: 'challenge', challengeId },
        ];
        const res = await dualteacherDb.insertOne('dualunits', { ...params });

        await dualteacherDb.updateOne('dualpackages', { _id: Mongodb.ObjectID(args._id) }, {
            $set: {
                updateTime: new Date(),
            },
            $push: {
                units: res.insertedId,
            },
        });
        return { success: true, msg: '插入-' + JSON.stringify(args) + '成功' };
    },
    async updateDualUnit(parent, args, { dualteacherDb }, info) {
        const { params } = args;
        // handle del  segments
        console.log('updateDualUnit.params=->', params);
        if (params.name) {
            params.name = {
                en: params.name,
                zh: params.name,
            };
        }
        await dualteacherDb.updateOne('dualunits', { _id: Mongodb.ObjectID(args._id) }, { $set: {
            ...params,
        } });

        return { success: true, msg: '更新' + args._id + '成功' };
    },
    async insertDualCourse(parent, args, { dualteacherDb }, info) {
        const { params } = args;
        const courseType = params.segmentType;
        delete params.segmentType;
        params.tag = params.type + '-tag-' + Date.now(),
        params.name = {
            en: params.name,
            zh: params.name,
        };
        params.defaultLayout = 'scratch_recorded/funcq';
        params.keywords = 'dualTeacher-segment';
        await dualteacherDb.insertOne('dualcourses', { ...params });
        // type=segments update units
        if (courseType === 'segment') {
            await dualteacherDb.updateOne('dualunits', { _id: Mongodb.ObjectID(params.unitId) }, { $push: {
                segments: params,
            } });
        }
        return { success: true, msg: '插入-' + JSON.stringify(args) + '成功' };
    },
    async updateDualCourse(parent, args, { dualteacherDb }, info) {
        const { params } = args;
        if (params.segment && params.segment[0].del) {
            // const segmentId=params.segment[0].segmentId;
            // let unitUpdate = await dualteacherDb.updateOne('dualunits', { _id: Mongodb.ObjectID(args._id) }, { $pull: { segments: { _id: Mongodb.ObjectID(segmentId) } } }, { returnOriginal: false });
            // if (!unitUpdate.ok || !unitUpdate.value) throw new Error('删除失败');
            // const upCourseRes = await dualteacherDb.updateOne('dualcourses', { _id:params.courses[0].courseId }, { $pull: { segments: { _id: Mongodb.ObjectID(segmentId) } } });
            // return { success: true, msg: '删除' + args._id + '成功,upCourseRes'+upCourseRes };
        }
        params.tag = params.type + '-tag-' + Date.now(),
        params.defaultLayout = 'scratch_recorded/funcq';
        params.keywords = 'dualTeacher-segment';
        delete params.type;
        if (params.level) {
            for (const l of params.level) {
                l.levelId = Mongodb.ObjectId();
                l.name = {
                    en: l.name,
                    zh: l.name,
                };
                l.layout = 'scratch_recorded/funcq';
            }
        }

        if (params.name) {
            params.name = { en: params.type + 'zh' + params.name + Date.now(), zh: params.type + 'en' + params.name + Date.now() };
        }
        const level = params.level;
        delete params.level;
        const upsertResult = await dualteacherDb.updateOne('dualcourses', { _id }, {
            $set: {
                ...params,
            },
            $push: {
                level,
            },
        }, { upsert: true });
        console.log('upsertResult-==>', upsertResult);
        // if(upsertResult.ok===1&&type==='segment'){
        //     //update units
        //     await dualteacherDb.updateOne('dualcourses', { _id }, { $set: {
        //         ...params,
        //     }, $push: { level } }, { upsert: true })
        // }
        return { success: true, msg: '更新成功' };
    },
    async insertDualProduct(parent, args, { dualteacherDb }, info) {
        const { params } = args;
        params.v1 = JSON.stringify(params.v1);
        params.price = {
            nominal: params.price,
        };
        params.createTime = new Date();
        params.updateTime = new Date();
        await dualteacherDb.insertOne('dualproducts', { ...params });
        return { success: true, msg: '插入-' + JSON.stringify(args) + '成功' };
    },
    async updateDualProduct(parent, args, { dualteacherDb }, info) {
        const { params } = args;
        if (params.price) {
            params.price = {
                nominal: params.price,
            };
        }
        params.updateTime = new Date();
        await dualteacherDb.updateOne('dualproducts', { _id: Mongodb.ObjectID(args._id) }, { $set: {
            ...params,
        } });
        return { success: true, msg: '更新' + args._id + '成功' };
    },
    async insertDualOrder(parent, args, { dualteacherDb }, info) {
        const { params } = args;
        params.createTime = new Date();
        if (params.pay_v1) { params.pay_v1 = { regUser2Id: params.pay_v1 }; }
        await dualteacherDb.insertOne('dualorders', { ...params });
        return { success: true, msg: '插入-' + JSON.stringify(args) + '成功' };
    },
    async updateDualOrder(parent, args, { dualteacherDb }, info) {
        // const {params }=args;
        // await dualteacherDb.updateOne("dualorders", {_id: Mongodb.ObjectID(args._id)},{$set:{
        //     name:args.name
        // }});
        return { success: true, msg: '更新' + args._id + '成功' };
    },
    async insertDualCampuse(parent, args, { dualteacherDb }, info) {
        const { params } = args;
        params.createTime = new Date();
        params.updateTime = new Date();
        await dualteacherDb.insertOne('dualcampuses', { ...params });
        return { success: true, msg: '插入-' + JSON.stringify(args) + '成功' };
    },
    async updateDualCampuse(parent, args, { dualteacherDb }, info) {
        const { params } = args;
        params.updateTime = new Date();
        await dualteacherDb.updateOne('dualcampuses', { _id: Mongodb.ObjectID(args._id) }, { $set: {
            ...params,
        } });
        return { success: true, msg: '更新' + args._id + '成功' };
    },
    // handle dual segment，it's a base
    async insertDualCourseLevel(parent, args, { dualteacherDb }, info) {
        const { params } = args;
        const courseType = params.courseType;
        const unitId = params.unitId;
        const courseId = params.courseId;
        const levelId = params.levelId;
        delete params.courseType;
        delete params.unitId;
        delete params.courseId;
        const levels = {
            levelId,
            name: {
                    en: params.title,
                    zh: params.title,
                },
                layout: 'scratch_recorded/funcq',
        };
        if (courseType === 'segment') {
            const segmentId = Mongodb.ObjectId();
            levels.segmentId = segmentId;
            params.segmentId = segmentId;
        }
        const updateUnitsRes = await dualteacherDb.updateOne('dualCourses', { _id: Mongodb.ObjectID(courseId) }, {
            $set: {
                _id: courseId,
                tag: courseType + '-tag-' + courseId,
                name: {
                    zh: courseType + '-zh-' + courseId,
                    en: courseType + '-en-' + courseId,
                },
                defaultLayout: 'scratch_recorded/funcq',
                keywords: 'dualTeacher-segment',
            },
            $push: {
                levels,
            },
        }, { $upsert: true });
        let updateCourseRes;
        if (courseType === 'segment') {
            if (updateUnitsRes.ok === 1) {
                updateCourseRes = await dualteacherDb.updateOne('dualunits', { _id: Mongodb.ObjectID(unitId) }, {
                    $set: {
                        updateTime: new Date(),
                    },
                    $push: {
                        segments: params,
                    },
                });

            }
        }
        return { success: true, msg: 'insertDualCourseLevel' + courseId + '成功,mongo res:', updateCourseRes };
    },
    async updateDualCourseLevel(parent, args, { dualteacherDb }, info) {
        const { params } = args;
        const courseType = params.courseType;
        const unitId = params.unitId;
        const levelId = params.levelId;
        delete params.courseType;
        delete params.unitId;
        delete params.levelId;
        if (params.del) {
            const delCourseRes = await dualteacherDb.updateOne('dualCourses',
                { _id: Mongodb.ObjectID(unitId), 'levels.levelId': Mongodb.ObjectID(levelId) },
                { $pull: { levels: { segmentId: Mongodb.ObjectID(levelId) } } },
                { returnOriginal: false });
            if (courseType === 'segment') {
            const delSegmentRes = await dualteacherDb.updateOne('dualunits', { _id: Mongodb.ObjectID(unitId), 'segments.levelId': Mongodb.ObjectID(levelId) },
                { $pull: { levels: { levelId } } },
                { returnOriginal: false });
            }
            return { success: true, msg: 'delDualSegment' + args._id + '成功', delCourseRes, delSegmentRes };
        }
         // level update
         let updateCourseRes = [];
         const updateDualCourseFilter = [ '单选题', '多选题', '填空题', 'Geekbot编程题', '评分' ];
         if (updateDualCourseFilter.indexOf(params.type) < 0) return { success: true, msg: 'updateDualSegment faild, we only have type= 单选题,多选题，填空题,Geekbot编程题,评分' };
         // update course
         updateCourseRes = await dualteacherDb.updateOne('dualCourses', { _id: Mongodb.ObjectID(unitId), 'levels.levelId': Mongodb.ObjectID(levelId) }, { $set: {
            ...params,
        } }, { returnOriginal: false });

         // update units
         let pushCourseRes = '';
         let pullCourseRes = '';
         if (courseType === 'segment') {
            if (updateCourseRes.ok === 1) {
                pushCourseRes = await dualteacherDb.updateOne('dualunits',
                    { _id: Mongodb.ObjectID(unitId), 'segments.levelId': Mongodb.ObjectID(levelId) },
                    { $pull: { levels: { levelId: Mongodb.ObjectID(levelId) } } },
                    { returnOriginal: false });
                pullCourseRes = await dualteacherDb.updateOne('dualunits',
                    { _id: Mongodb.ObjectID(unitId), 'segments.levelId': Mongodb.ObjectID(levelId) },
                    { $push: { levels: params } },
                    { returnOriginal: false });
            }
        }
        return { success: true, msg: 'updateDualSegment' + args._id + '成功' + pushCourseRes, pullCourseRes };
    },
};

module.exports = Mutation;

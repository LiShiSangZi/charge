# 价格管理
Product对象是用来管理产品的价格。目前只支持实时计费。
## 概念
1. Region: 必填，记录该地域的计费的业务。
2. name: 必填，在计费体系中，name*不是随便命名的*。name由三个元素构成：${module}:${type}:${other}。由":"分开。其中module代表对应的OpenStack模块。type代表对应的实体。other是用来备用的。举个例子，对于云硬盘，名称就是cinder:volume，没有other。other是用来做一些其他信息的传递的。举个例子，对于云主机，因为云主机的计费是基于flavor的，不同的flavor，有不同的价格，所以云主机的product的名称应该是像这个样子：nova:server:1。其中1是对应的flavor id。
3. 价格：记录product的价格。
## 业务逻辑
* 当有product被新建时，会扫描所有的对应的资源，生成新的order。
* 当有product被修改时，会找到所有对应的order，立即结算并且关闭所有的相关order。然后重新生成。
* 当有product被删除时，会找到所有对应的order，立即结算并且关闭。
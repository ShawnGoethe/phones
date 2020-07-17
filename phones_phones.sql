-- MySQL dump 10.13  Distrib 8.0.20, for macos10.15 (x86_64)
--
-- Host: 39.105.25.74    Database: phones
-- ------------------------------------------------------
-- Server version	5.7.30

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `phones`
--

DROP TABLE IF EXISTS `phones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phones` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `name` varchar(45) CHARACTER SET latin1 NOT NULL,
  `brand` varchar(45) CHARACTER SET latin1 DEFAULT NULL,
  `price` int(11) NOT NULL,
  `inch` float DEFAULT NULL,
  `battery` int(11) DEFAULT NULL,
  `nfc` varchar(4) DEFAULT NULL,
  `headphone_plug` varchar(45) DEFAULT NULL,
  `charging` int(11) DEFAULT NULL,
  `os` varchar(45) CHARACTER SET latin1 DEFAULT NULL,
  `dual_speaker` varchar(4) DEFAULT NULL,
  `front_camera` varchar(20) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `del` tinyint(4) DEFAULT NULL,
  `desc` varchar(100) DEFAULT NULL,
  `rear_camera` varchar(20) DEFAULT NULL,
  `now_price` int(11) DEFAULT NULL,
  `cpu` varchar(45) DEFAULT NULL,
  `front_max` int(11) DEFAULT NULL,
  `rear_max` int(11) DEFAULT NULL,
  `cg` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phones`
--

LOCK TABLES `phones` WRITE;
/*!40000 ALTER TABLE `phones` DISABLE KEYS */;
INSERT INTO `phones` VALUES (1,'Xiaomi10','Xiaomi',3999,6.67,4780,'是','type-c',30,'MIUI','是','挖单孔','2020-07-16 08:39:02','2020-07-16 08:39:02',0,'','4',3799,'Snapdragon 865',20,10,5),(2,'Xiaomi10 Pro 8+256','Xiaomi',4999,6.67,4500,'是','type-c',50,'MIUI','是','挖单孔','2020-07-16 08:40:10','2020-07-16 08:40:10',0,'','4',4999,'Snapdragon 865',20,10,5),(3,'Redmi 9 4+64','Xiaomi',799,6.53,5020,'是','3.5mm',18,'MIUI','否','屏下方式','2020-07-16 08:42:07','2020-07-16 08:42:07',0,'','3+',799,'MTK Helio G80',8,13,4),(4,'Redmi K30 Pro 8+128','Xiaomi',2999,6.67,4700,'是','type-c',33,'MIUI','否','弹出方式','2020-07-16 08:44:04','2020-07-16 08:44:04',0,'','3+',2699,'865',NULL,NULL,5),(5,'Redmi K30 4G 6+128','Xiaomi',1699,6.67,4500,'是','3.5mm',27,'MIUI','否','弹出方式','2020-07-16 09:05:06','2020-07-16 09:05:06',0,'','4',1399,NULL,20,64,4),(6,'Redmi K30 5G 6+64','Xiaomi',1999,6.67,45,'是','3.5mm',27,'MIUI','否','弹出方式','2020-07-16 09:08:42','2020-07-16 09:08:42',0,'','4',1999,'Snapdragon 765G',20,64,5),(7,'Xiaomi 10 Lite 5G 4+64','Xiaomi',2099,6.57,4160,'是','3.5mm',23,'MIUI','否','刘海方式','2020-07-16 09:24:19','2020-07-16 09:24:19',0,'','4',1899,'Snapdragon 765G',16,48,5),(8,'Xiaomi CC9 6+64','Xiaomi',1799,6.39,4030,'是','3.5mm',18,'MIUI','否','刘海方式','2020-07-16 09:28:07','2020-07-16 09:28:07',0,'','3',1499,'Snapdragon 730G',32,48,4),(9,'Xiaomi CC9e 4+64','Xiaomi',1299,6.08,4030,'是','3.5mm',10,'MIUI','否','刘海方式','2020-07-16 09:29:59','2020-07-16 09:29:59',0,'','3',1099,'Snapdragon 712',32,48,4),(10,'Redmi 10X 4G 4+128','Xiaomi',999,6.53,5020,'是','3.5mm',18,'MIUI','否','挖单孔','2020-07-16 09:33:28','2020-07-16 09:33:28',0,'','4',999,'MTK Helio G85',13,48,4),(11,'Redmi 10X 5G 6+64','Xiaomi',1599,6.57,4520,'否','3.5mm',30,'MIUI','否','刘海方式','2020-07-16 09:36:25','2020-07-16 09:36:25',0,'','3',1599,'MediaTek Dimensity 820',16,48,5),(12,'Redmi 10X Pro 5G 8+128','Xiaomi',2299,6.57,4520,'是','3.5mm',30,'MIUI','否','刘海方式','2020-07-16 09:37:23','2020-07-16 09:37:23',0,'','4',2299,'MediaTek Dimensity 820',20,48,5);
/*!40000 ALTER TABLE `phones` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2020-07-17 14:59:28

-- Gold Platform Database Schema
-- Migration: 0001_init

-- ============================================
-- 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
  membership_level TEXT NOT NULL DEFAULT 'free' CHECK(membership_level IN ('free', 'basic', 'premium', 'vip')),
  membership_expire_at TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_membership_level ON users(membership_level);
CREATE INDEX idx_users_status ON users(status);

-- ============================================
-- 会员等级表
-- ============================================
CREATE TABLE IF NOT EXISTS membership_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  price_monthly REAL NOT NULL DEFAULT 0,
  price_yearly REAL NOT NULL DEFAULT 0,
  features TEXT NOT NULL DEFAULT '[]',
  max_api_calls_per_day INTEGER NOT NULL DEFAULT 100,
  max_ai_analysis_per_day INTEGER NOT NULL DEFAULT 3,
  can_view_advanced_analysis INTEGER NOT NULL DEFAULT 0,
  can_view_institution_views INTEGER NOT NULL DEFAULT 0,
  can_view_investment_advice INTEGER NOT NULL DEFAULT 0,
  can_use_push_notification INTEGER NOT NULL DEFAULT 0,
  can_view_realtime_data INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- 权限表
-- ============================================
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  module TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- 角色权限关联表
-- ============================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  permission_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role, permission_id)
);

-- ============================================
-- 国际金价表
-- ============================================
CREATE TABLE IF NOT EXISTS gold_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  open_price REAL NOT NULL,
  high_price REAL NOT NULL,
  low_price REAL NOT NULL,
  close_price REAL NOT NULL,
  volume REAL DEFAULT 0,
  change_percent REAL DEFAULT 0,
  source TEXT DEFAULT 'api',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, source)
);

CREATE INDEX idx_gold_prices_date ON gold_prices(date);
CREATE INDEX idx_gold_prices_source ON gold_prices(source);

-- ============================================
-- 美元指数表
-- ============================================
CREATE TABLE IF NOT EXISTS dollar_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  open_price REAL NOT NULL,
  high_price REAL NOT NULL,
  low_price REAL NOT NULL,
  close_price REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date)
);

CREATE INDEX idx_dollar_index_date ON dollar_index(date);

-- ============================================
-- 黄金新闻表
-- ============================================
CREATE TABLE IF NOT EXISTS gold_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  source TEXT DEFAULT '',
  url TEXT DEFAULT '',
  published_at TEXT,
  sentiment TEXT DEFAULT 'neutral' CHECK(sentiment IN ('positive', 'negative', 'neutral')),
  keywords TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_gold_news_published ON gold_news(published_at);
CREATE INDEX idx_gold_news_sentiment ON gold_news(sentiment);

-- ============================================
-- 市场因素表
-- ============================================
CREATE TABLE IF NOT EXISTS market_factors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('bullish', 'bearish')),
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  description TEXT DEFAULT '',
  details TEXT DEFAULT '[]',
  impact TEXT NOT NULL DEFAULT 'medium' CHECK(impact IN ('low', 'medium', 'high')),
  confidence REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_market_factors_type ON market_factors(type);

-- ============================================
-- 机构观点表
-- ============================================
CREATE TABLE IF NOT EXISTS institution_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_name TEXT NOT NULL,
  logo TEXT DEFAULT '',
  rating TEXT DEFAULT 'neutral' CHECK(rating IN ('buy', 'hold', 'sell', 'neutral')),
  target_price REAL DEFAULT 0,
  timeframe TEXT DEFAULT '',
  reasoning TEXT DEFAULT '',
  key_points TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- 预测表
-- ============================================
CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prediction_type TEXT NOT NULL,
  target_price REAL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0.5,
  timeframe TEXT DEFAULT '',
  reasoning TEXT DEFAULT '',
  factors TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- 市场摘要缓存表
-- ============================================
CREATE TABLE IF NOT EXISTS market_summary_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL DEFAULT '{}',
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_market_summary_key ON market_summary_cache(cache_key);

-- ============================================
-- 更新日志表
-- ============================================
CREATE TABLE IF NOT EXISTS update_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success' CHECK(status IN ('success', 'failed', 'running')),
  records_affected INTEGER DEFAULT 0,
  error_message TEXT DEFAULT '',
  duration_seconds REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_update_logs_type ON update_logs(data_type);
CREATE INDEX idx_update_logs_status ON update_logs(status);

-- ============================================
-- API 使用日志表
-- ============================================
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  status_code INTEGER NOT NULL DEFAULT 200,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_api_usage_user ON api_usage_logs(user_id);
CREATE INDEX idx_api_usage_endpoint ON api_usage_logs(endpoint);
CREATE INDEX idx_api_usage_created ON api_usage_logs(created_at);

-- ============================================
-- 默认数据插入
-- ============================================

-- 默认管理员用户 (密码: admin123, SHA-256 salted hash)
-- hash格式: salt:hash, salt='goldplatform2024'
-- SHA-256('goldplatform2024admin123') = fb18d77a8cc59ca99b5dc8289bd3138c9bf4d5473d32ef3f17341ae6e653f917
INSERT INTO users (email, username, password_hash, avatar, role, membership_level, status) VALUES
('admin@goldplatform.com', 'admin', 'goldplatform2024:fb18d77a8cc59ca99b5dc8289bd3138c9bf4d5473d32ef3f17341ae6e653f917', '', 'admin', 'vip', 'active');

-- 会员等级
INSERT INTO membership_levels (name, code, price_monthly, price_yearly, features, max_api_calls_per_day, max_ai_analysis_per_day, can_view_advanced_analysis, can_view_institution_views, can_view_investment_advice, can_use_push_notification, can_view_realtime_data) VALUES
('免费版', 'free', 0, 0, '["基础金价查询","每日3次AI分析","基础K线图"]', 100, 3, 0, 0, 0, 0, 0),
('基础版', 'basic', 29.9, 299, '["实时金价查询","每日10次AI分析","完整K线图","市场因素分析","邮件推送"]', 500, 10, 1, 0, 0, 1, 1),
('专业版', 'premium', 99.9, 999, '["实时金价查询","无限AI分析","完整K线图","市场因素分析","机构观点","投资建议","微信推送"]', 2000, 50, 1, 1, 1, 1, 1),
('VIP版', 'vip', 299.9, 2999, '["实时金价查询","无限AI分析","完整K线图","市场因素分析","机构观点","投资建议","专属推送","实时数据流","1对1顾问"]', 10000, 999, 1, 1, 1, 1, 1);

-- 权限 - dashboard模块
INSERT INTO permissions (name, code, description, module) VALUES
('仪表盘查看', 'dashboard:view', '查看仪表盘', 'dashboard'),
('仪表盘编辑', 'dashboard:edit', '编辑仪表盘布局', 'dashboard');

-- 权限 - price模块
INSERT INTO permissions (name, code, description, module) VALUES
('金价查看', 'price:view', '查看金价数据', 'price'),
('金价实时数据', 'price:realtime', '查看实时金价数据', 'price'),
('金价历史数据', 'price:history', '查看历史金价数据', 'price');

-- 权限 - analysis模块
INSERT INTO permissions (name, code, description, module) VALUES
('分析查看', 'analysis:view', '查看基础分析', 'analysis'),
('高级分析', 'analysis:advanced', '查看高级分析', 'analysis'),
('AI分析', 'analysis:ai', '使用AI分析功能', 'analysis');

-- 权限 - news模块
INSERT INTO permissions (name, code, description, module) VALUES
('新闻查看', 'news:view', '查看新闻资讯', 'news');

-- 权限 - institution模块
INSERT INTO permissions (name, code, description, module) VALUES
('机构观点查看', 'institution:view', '查看机构观点', 'institution');

-- 权限 - investment模块
INSERT INTO permissions (name, code, description, module) VALUES
('投资建议查看', 'investment:view', '查看投资建议', 'investment');

-- 权限 - push模块
INSERT INTO permissions (name, code, description, module) VALUES
('推送通知', 'push:use', '使用推送通知功能', 'push');

-- 权限 - admin_users模块
INSERT INTO permissions (name, code, description, module) VALUES
('用户管理', 'admin:users', '管理用户', 'admin_users'),
('用户查看', 'admin:users:view', '查看用户信息', 'admin_users'),
('用户编辑', 'admin:users:edit', '编辑用户信息', 'admin_users'),
('用户删除', 'admin:users:delete', '删除用户', 'admin_users');

-- 权限 - admin_membership模块
INSERT INTO permissions (name, code, description, module) VALUES
('会员管理', 'admin:membership', '管理会员等级', 'admin_membership'),
('会员查看', 'admin:membership:view', '查看会员等级', 'admin_membership'),
('会员编辑', 'admin:membership:edit', '编辑会员等级', 'admin_membership');

-- 权限 - admin_permissions模块
INSERT INTO permissions (name, code, description, module) VALUES
('权限管理', 'admin:permissions', '管理权限', 'admin_permissions'),
('权限查看', 'admin:permissions:view', '查看权限', 'admin_permissions'),
('权限编辑', 'admin:permissions:edit', '编辑权限', 'admin_permissions');

-- 权限 - admin_system模块
INSERT INTO permissions (name, code, description, module) VALUES
('系统管理', 'admin:system', '系统管理', 'admin_system'),
('系统日志', 'admin:system:logs', '查看系统日志', 'admin_system'),
('系统配置', 'admin:system:config', '修改系统配置', 'admin_system');

-- 管理员角色权限 (所有权限)
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions;

-- 普通用户角色权限 (基础权限)
INSERT INTO role_permissions (role, permission_id)
SELECT 'user', id FROM permissions WHERE code IN (
  'dashboard:view',
  'price:view',
  'price:history',
  'analysis:view',
  'news:view',
  'push:use'
);

// ============================================
// GasYar Backend - Express Server
// ============================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { createClient } from '@supabase/supabase-js';

// بارگذاری متغیرهای محیطی
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8092;

// ============================================
// Supabase Client
// ============================================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ============================================
// Middleware
// ============================================

// CORS
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ============================================
// Routes
// ============================================

// صفحه خوش‌آمد
app.get('/', (req, res) => {
  res.json({
    message: 'خوش‌آمدید به GasYar Backend API',
    version: '1.0.0',
    status: 'فعال'
  });
});

// صحت سرور
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// Authentication Routes
// ============================================

// ثبت‌نام کاربر جدید
app.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password, full_name, phone, company_id, role } = req.body;

    // Validation
    if (!username || !email || !password || !full_name || !company_id) {
      return res.status(400).json({
        success: false,
        message: 'لطفاً تمام فیلدهای ضروری را پر کنید'
      });
    }

    // درج کاربر جدید
    const { data, error } = await supabase
      .from('users')
      .insert({
        username,
        email,
        password: Buffer.from(password).toString('base64'), // ساده - بعداً رمزگذاری بهتر
        full_name,
        phone,
        company_id,
        role: role || 'driver'
      })
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'خطا در ثبت‌نام: ' + error.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'کاربر با موفقیت ثبت‌نام شد',
      data: data[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطای سرور: ' + error.message
    });
  }
});

// ورود کاربر
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'نام کاربری و رمز عبور ضروری است'
      });
    }

    // جستجو برای کاربر
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !users) {
      return res.status(401).json({
        success: false,
        message: 'نام کاربری یا رمز عبور اشتباه است'
      });
    }

    // بررسی رمز عبور
    const passwordMatch = Buffer.from(password).toString('base64') === users.password;

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'نام کاربری یا رمز عبور اشتباه است'
      });
    }

    // بروزرسانی last_login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', users.id);

    res.json({
      success: true,
      message: 'ورود موفق',
      data: {
        id: users.id,
        username: users.username,
        full_name: users.full_name,
        role: users.role,
        company_id: users.company_id
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطای سرور: ' + error.message
    });
  }
});

// ============================================
// Company Routes
// ============================================

// دریافت اطلاعات شرکت
app.get('/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        message: 'شرکت یافت نشد'
      });
    }

    res.json({
      success: true,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطای سرور: ' + error.message
    });
  }
});

// ایجاد شرکت جدید
app.post('/company/create', async (req, res) => {
  try {
    const { company_name, owner_name, owner_email, owner_phone, city } = req.body;

    if (!company_name || !owner_name || !owner_email) {
      return res.status(400).json({
        success: false,
        message: 'اطلاعات شرکت ناقص است'
      });
    }

    const { data, error } = await supabase
      .from('companies')
      .insert({
        company_name,
        owner_name,
        owner_email,
        owner_phone,
        city
      })
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'خطا در ایجاد شرکت: ' + error.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'شرکت با موفقیت ایجاد شد',
      data: data[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطای سرور: ' + error.message
    });
  }
});

// ============================================
// Delivery Routes (تحویل‌ها)
// ============================================

// ثبت تحویل جدید
app.post('/delivery/create', async (req, res) => {
  try {
    const {
      company_id,
      delivery_date,
      driver_id,
      customer_id,
      gas_type_id,
      quantity,
      price_per_cylinder,
      return_date,
      notes
    } = req.body;

    // Validation
    if (!company_id || !driver_id || !customer_id || !quantity || !price_per_cylinder) {
      return res.status(400).json({
        success: false,
        message: 'لطفاً تمام فیلدهای ضروری را پر کنید'
      });
    }

    const total_amount = quantity * price_per_cylinder;

    const { data, error } = await supabase
      .from('deliveries')
      .insert({
        company_id,
        delivery_date: delivery_date || new Date().toISOString().split('T')[0],
        driver_id,
        customer_id,
        gas_type_id,
        quantity,
        price_per_cylinder,
        total_amount,
        return_date,
        notes,
        delivery_status: 'completed'
      })
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'خطا در ثبت تحویل: ' + error.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'تحویل با موفقیت ثبت شد',
      data: data[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطای سرور: ' + error.message
    });
  }
});

// دریافت تمام تحویل‌های شرکت (روزانه)
app.get('/delivery/company/:companyId/today', async (req, res) => {
  try {
    const { companyId } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        *,
        driver:drivers(first_name, last_name, phone),
        customer:customers(customer_name, business_sector),
        gas:gases(gas_name, gas_symbol)
      `)
      .eq('company_id', companyId)
      .eq('delivery_date', today)
      .order('created_date', { ascending: false });

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'خطا در دریافت داده‌ها: ' + error.message
      });
    }

    res.json({
      success: true,
      data,
      count: data.length
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطای سرور: ' + error.message
    });
  }
});

// دریافت تحویل‌های راننده
app.get('/delivery/driver/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;

    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        *,
        customer:customers(customer_name, customer_address),
        gas:gases(gas_name, gas_symbol)
      `)
      .eq('driver_id', driverId)
      .order('created_date', { ascending: false });

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'خطا: ' + error.message
      });
    }

    res.json({
      success: true,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطای سرور: ' + error.message
    });
  }
});

// ============================================
// Reports Routes (گزارش‌ها)
// ============================================

// گزارش درآمد روزانه
app.get('/report/daily/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { date } = req.query;
    
    const queryDate = date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('deliveries')
      .select('total_amount, quantity, gas:gases(gas_name)')
      .eq('company_id', companyId)
      .eq('delivery_date', queryDate);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'خطا: ' + error.message
      });
    }

    const totalRevenue = data.reduce((sum, d) => sum + d.total_amount, 0);
    const totalCylinders = data.reduce((sum, d) => sum + d.quantity, 0);

    res.json({
      success: true,
      date: queryDate,
      totalRevenue,
      totalCylinders,
      deliveryCount: data.length,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطای سرور: ' + error.message
    });
  }
});

// گزارش درآمد ماهانه
app.get('/report/monthly/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month } = req.query;
    
    const queryMonth = month || new Date().toISOString().substring(0, 7);

    const { data, error } = await supabase
      .from('deliveries')
      .select('total_amount, quantity, delivery_date, gas:gases(gas_name)')
      .eq('company_id', companyId)
      .like('delivery_date', queryMonth + '%');

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'خطا: ' + error.message
      });
    }

    const totalRevenue = data.reduce((sum, d) => sum + d.total_amount, 0);
    const totalCylinders = data.reduce((sum, d) => sum + d.quantity, 0);

    res.json({
      success: true,
      month: queryMonth,
      totalRevenue,
      totalCylinders,
      deliveryCount: data.length,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطای سرور: ' + error.message
    });
  }
});

// ============================================
// Gas Management Routes
// ============================================

// دریافت تمام انواع گاز
app.get('/gases/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;

    const { data, error } = await supabase
      .from('gases')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'خطا: ' + error.message
      });
    }

    res.json({
      success: true,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطای سرور: ' + error.message
    });
  }
});

// ============================================
// Customers Routes
// ============================================

// دریافت تمام مشتریان
app.get('/customers/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'خطا: ' + error.message
      });
    }

    res.json({
      success: true,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطای سرور: ' + error.message
    });
  }
});

// ============================================
// 404 Handler
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'این مسیر یافت نشد'
  });
});

// ============================================
// شروع سرور
// ============================================
app.listen(PORT, () => {
  console.log(`✅ GasYar Backend فعال است`);
  console.log(`🚀 سرور در پورت ${PORT} در حال کار است`);
  console.log(`📍 آدرس: http://localhost:${PORT}`);
});

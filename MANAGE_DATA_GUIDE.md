# 📊 Manage Data - Complete Understanding

## Overview
The **Manage Data** page (ManageDataPage.js) allows you to **Edit** and **Delete** all master data in one place. It's different from Admin Dashboard:
- **Admin Dashboard**: ✅ Create new data
- **Manage Data**: ✏️ Edit & ❌ Delete existing data

---

## 📋 How It Works - Step by Step

### **Step 1: Load All Data**
```
When user opens Manage Data page
    ↓
loadAllData() function runs
    ↓
    Fetches from Backend:
    ├── All Departments
    ├── All Programs (Courses)
    ├── All Subjects
    └── All Teachers
    ↓
Data is stored in State & displayed in Tables
```

---

## ✏️ EDIT OPERATION - How It Works

### **Example: Editing a Department**

```
┌─────────────────────────────────────────┐
│  DEPARTMENT TABLE (Shows all items)     │
├─────────────────────────────────────────┤
│  Name: CSE      [Edit] [Delete]         │
│  Name: ECE      [Edit] [Delete]         │
│  Name: ME       [Edit] [Delete]         │
└─────────────────────────────────────────┘
           ↓ (User clicks Edit button)
           ↓
┌─────────────────────────────────────────┐
│  EDIT FORM (Appears at top)             │
├─────────────────────────────────────────┤
│  Name: [CSE    ] (input field)          │
│  [Update] [Cancel]                      │
└─────────────────────────────────────────┘
           ↓ (User changes name)
           ↓
           ↓ (User clicks Update)
           ↓
┌─ Send to Backend ─┐
│ PUT /master/      │
│ department/{id}   │
│ Data: {name}      │
└───────────────────┘
           ↓
           ↓ (Success)
           ↓
    Table updates
    Form clears
    Success message shown
```

---

## ❌ DELETE OPERATION - How It Works

### **Example: Deleting a Program**

```
┌─────────────────────────────────────────┐
│  PROGRAM TABLE                          │
├─────────────────────────────────────────┤
│  Name: B.Tech    [Edit] [Delete]        │
│  Name: M.Tech    [Edit] [Delete]        │
└─────────────────────────────────────────┘
           ↓ (User clicks Delete)
           ↓
┌─────────────────────────────────────────┐
│  Confirmation Dialog                    │
├─────────────────────────────────────────┤
│  "Delete program 'B.Tech'?"             │
│  [OK] [Cancel]                          │
└─────────────────────────────────────────┘
           ↓ (User clicks OK)
           ↓
┌─ Send to Backend ─┐
│ DELETE /master/   │
│ course/{id}       │
└───────────────────┘
           ↓
           ↓ (Success)
           ↓
    Item removed from table
    Success message shown
```

---

## 🔄 State Management

### **Edit State Variables**

```javascript
// Each entity has its own edit state
const [departmentEdit, setDepartmentEdit] = useState({
  id: '',           // Item ID to update
  name: ''          // Current name being edited
});

const [courseEdit, setCourseEdit] = useState({
  id: '',           // Item ID
  name: '',         // Name being edited
  departmentId: ''  // Parent department
});

const [subjectEdit, setSubjectEdit] = useState({
  id: '',           // Item ID
  name: '',         // Name being edited
  courseId: ''      // Parent course
});

const [teacherEdit, setTeacherEdit] = useState({
  id: '',           // Item ID
  name: '',         // Name being edited
  departmentId: '', // Department
  subjectIds: []    // Teaching subjects
});
```

---

## 📝 Complete Edit Workflow

### **1. Click Edit Button**
```javascript
handleDepartmentEditClick = (item) => {
  setDepartmentEdit({
    id: item._id,           // Store ID
    name: item.name || ''   // Store current name
  });
}
```
→ Fills the edit form with current data

### **2. User Modifies Input**
```javascript
<input
  type="text"
  value={departmentEdit.name}
  onChange={(e) => {
    setDepartmentEdit((prev) => ({
      ...prev,
      name: e.target.value  // Update as user types
    }))
  }}
/>
```
→ State updates as user types

### **3. Click Update Button**
```javascript
handleDepartmentUpdate = async () => {
  // Validation
  if (!departmentEdit.id || !departmentEdit.name.trim()) return;
  
  try {
    // Send to backend
    await API.put(`/master/department/${departmentEdit.id}`, {
      name: departmentEdit.name.trim()
    });
    
    // Refresh all data
    await loadAllData();
    
    // Notify other pages
    notifyMasterDataChanged();
    
    // Clear form
    setDepartmentEdit({ id: '', name: '' });
    
    // Show success
    setStatus({ type: 'success', message: 'Department updated.' });
  } catch (error) {
    setStatus({ type: 'error', message: 'Failed to update.' });
  }
}
```

### **4. Form Clears**
```
Edit Form shows:
├── Empty input field
└── Update & Cancel buttons DISABLED

Table shows:
└── Updated data
```

---

## 🗑️ Complete Delete Workflow

### **1. Click Delete Button**
```javascript
handleDepartmentDelete = async (item) => {
  // Show confirmation dialog
  if (!window.confirm(`Delete department "${item.name}"?`)) return;
  
  try {
    // Send delete request to backend
    await API.delete(`/master/department/${item._id}`);
    
    // Refresh all data
    await loadAllData();
    
    // Notify other pages
    notifyMasterDataChanged();
    
    // Clear edit form if it had this item
    if (departmentEdit.id === item._id) {
      setDepartmentEdit({ id: '', name: '' });
    }
    
    // Show success
    setStatus({ type: 'success', message: 'Department deleted.' });
  } catch (error) {
    setStatus({ type: 'error', message: 'Failed to delete.' });
  }
}
```

### **2. Item Removed**
```
Table automatically updates:
├── Item no longer appears
└── Other items still visible
```

---

## 🔗 Data Sync After Changes

After Edit or Delete:

```
1. loadAllData() is called
   ↓
2. All data is refreshed from backend
   ├── Departments refreshed
   ├── Courses refreshed
   ├── Subjects refreshed
   └── Teachers refreshed
   ↓
3. notifyMasterDataChanged() is called
   ↓
4. All other pages get notified
   ├── Admin Dashboard updates
   ├── Timetable Generator updates
   └── Faculty Dashboard updates
```

---

## 🎯 Key Features

| Feature | How It Works |
|---------|-------------|
| **Edit Form** | Appears when you click Edit button |
| **Validation** | Prevents empty names, requires parent entity |
| **Confirmation** | Shows dialog before deleting |
| **Auto Refresh** | Page refreshes after any change |
| **Sync** | Other pages automatically update |
| **Cascading** | Deleting parent may delete children |

---

## 🚀 Four Entities You Can Manage

### **1️⃣ Department (School)**
- Can Edit name
- Can Delete (if no courses attached)
- Shows in table with Edit/Delete buttons

### **2️⃣ Program (Course)**
- Can Edit name and department
- Can Delete (if no academics attached)
- Must have parent department

### **3️⃣ Subject (Specialization)**
- Can Edit name and course
- Can Delete (if not taught by any teacher)
- Must have parent course

### **4️⃣ Teacher (Faculty)**
- Can Edit name, department, and subjects
- Can Delete (if not assigned to timetable)
- Can assign multiple subjects

---

## 📊 Data Relationships

```
Department
    ├── Program (Course)
    │   ├── Subject
    │   │   └── Teacher (teaches this)
    │   └── Academic (Year/Term)
    │       └── Section
    │           └── Timetable Entry
    └── Teacher
        └── Timetable Entry
```

---

## ✅ Common Workflows

### **Workflow 1: Rename Department**
1. Click Edit on CSE
2. Change "CSE" to "Computer Science"
3. Click Update
4. ✅ Done - All timetables show "Computer Science"

### **Workflow 2: Remove Old Subject**
1. Click Edit on "Old Subject"
2. Click Delete
3. Confirm deletion
4. ✅ Done - Subject removed from all assignments

### **Workflow 3: Change Teacher Department**
1. Click Edit on Teacher
2. Select different department
3. Click Update
4. ✅ Done - Teacher moved to new department

---

## 🔐 Constraints & Limitations

```
❌ CANNOT DELETE if:
├── Department has Programs
├── Program has Subjects
├── Subject is taught by Teachers
├── Teacher has Timetable entries
└── Timetable exists for section

✅ CAN DELETE only if:
├── Item has no children
└── Item not referenced elsewhere
```

---

## 💡 Pro Tips

1. **Edit first, Delete later** - Always try editing before deleting
2. **Check cascading** - Deleting parent might fail if children exist
3. **Use Manage Data** - This is the place for bulk edits
4. **Use Admin Dashboard** - That's for creating new items
5. **Sync works automatically** - Don't worry about other pages

---

## 🔄 Backend APIs Used

| Operation | Method | Endpoint | Data |
|-----------|--------|----------|------|
| Update Department | PUT | `/master/department/{id}` | {name} |
| Update Course | PUT | `/master/course/{id}` | {name, departmentId} |
| Update Subject | PUT | `/master/subject/{id}` | {name, courseId} |
| Update Teacher | PUT | `/master/teacher/{id}` | {name, departmentId, subjects} |
| Delete Any | DELETE | `/master/{entity}/{id}` | — |

---

## 📱 UI Layout

```
┌─────────────────────────────────────────────────┐
│         MANAGE DATA - Page Header               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ MANAGE LAYOUT (2-Column Grid)                   │
├─────────────────────────────────────────────────┤
│                               │                  │
│  LEFT COLUMN                  │  RIGHT COLUMN   │
├───────────────────┬───────────┤─────────────────┤
│ Department        │  Program  │                 │
│ ┌─────────────┐   │ ┌─────┐   │                 │
│ │ Edit Form   │   │ │ ...  │  │                 │
│ │ [Update]    │   │ │ ...  │  │                 │
│ └─────────────┘   │ │ ...  │  │                 │
│ ┌─────────────┐   │ └─────┘   │                 │
│ │   TABLE     │   │           │                 │
│ │ Edit Delete │   │ [TABLE]   │                 │
│ └─────────────┘   │           │                 │
└─────────────────┬─┴───────────┘                 │
                  │                                │
           Status Messages                        │
└─────────────────────────────────────────────────┘
```

---

## 🎓 Summary

**The Manage Data page gives you a complete control center to:**

1. ✏️ **EDIT** - Change names and relationships
2. ❌ **DELETE** - Remove unused items
3. 🔄 **SYNC** - All changes propagate to other pages
4. 📊 **VIEW** - See all items in one place
5. 🔔 **VALIDATE** - System prevents invalid deletions

It's the **administrative hub** for maintaining your university's timetable data! 🎓


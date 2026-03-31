# 💻 Code Patterns - Edit & Delete Implementation

## Pattern 1: Edit State Management

```javascript
// State to track which item is being edited
const [departmentEdit, setDepartmentEdit] = useState({
  id: '',      // MongoDB ID of the item
  name: ''     // Current value being edited
});

// When user clicks Edit:
const handleDepartmentEditClick = (item) => {
  setDepartmentEdit({
    id: item._id,
    name: item.name
  });
  // Form input now shows department name
};

// When user types in input:
<input
  value={departmentEdit.name}
  onChange={(e) => setDepartmentEdit(prev => ({
    ...prev,
    name: e.target.value
  }))}
/>

// When user clicks Update:
const handleDepartmentUpdate = async () => {
  // Validate
  if (!departmentEdit.id || !departmentEdit.name.trim()) return;
  
  try {
    // Send to backend
    await API.put(`/master/department/${departmentEdit.id}`, {
      name: departmentEdit.name.trim()
    });
    
    // Reload all data
    await loadAllData();
    
    // Clear form
    setDepartmentEdit({ id: '', name: '' });
    
    setStatus({ 
      type: 'success', 
      message: 'Department updated.' 
    });
  } catch (error) {
    setStatus({ 
      type: 'error', 
      message: 'Update failed' 
    });
  }
};
```

---

## Pattern 2: Delete with Confirmation

```javascript
const handleDepartmentDelete = async (item) => {
  // Step 1: Show confirmation dialog
  if (!window.confirm(`Delete department "${item.name}"?`)) {
    return; // User clicked Cancel
  }
  
  try {
    // Step 2: Send delete request
    await API.delete(`/master/department/${item._id}`);
    
    // Step 3: Reload data
    await loadAllData();
    
    // Step 4: Notify other pages
    notifyMasterDataChanged();
    
    // Step 5: Clear form if active item was deleted
    if (departmentEdit.id === item._id) {
      setDepartmentEdit({ id: '', name: '' });
    }
    
    // Step 6: Show success message
    setStatus({ 
      type: 'success', 
      message: 'Department deleted.' 
    });
    
  } catch (error) {
    // Show error if delete fails
    setStatus({ 
      type: 'error', 
      message: error.response?.data?.error || 'Delete failed' 
    });
  }
};
```

---

## Pattern 3: Table with Edit/Delete Buttons

```javascript
<table className="manage-table">
  <thead>
    <tr>
      <th>Name</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {departments.map((item) => (
      <tr key={item._id}>
        <td>{item.name}</td>
        <td className="action-cell">
          {/* Edit button triggers form population */}
          <button 
            className="action-btn edit-btn" 
            onClick={() => handleDepartmentEditClick(item)}
          >
            Edit
          </button>
          
          {/* Delete button triggers delete workflow */}
          <button 
            className="action-btn delete-btn" 
            onClick={() => handleDepartmentDelete(item)}
          >
            Delete
          </button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

---

## Pattern 4: Edit Form UI

```javascript
<div className="manage-box">
  <h4>Department</h4>
  
  {/* Edit Form Section */}
  <div className="manage-edit-form">
    <input
      type="text"
      placeholder="Department name"
      value={departmentEdit.name}
      onChange={(e) => setDepartmentEdit((prev) => ({
        ...prev,
        name: e.target.value
      }))}
    />
    <div className="action-cell">
      <button 
        className="action-btn edit-btn" 
        onClick={handleDepartmentUpdate}
        disabled={!departmentEdit.id}  // Disabled if no item selected
      >
        Update
      </button>
      <button 
        className="action-btn delete-btn" 
        onClick={() => setDepartmentEdit({ id: '', name: '' })}
        disabled={!departmentEdit.id}  // Disabled if no item selected
      >
        Cancel
      </button>
    </div>
  </div>
  
  {/* Data Table Section */}
  <table className="manage-table">
    {/* Table content here */}
  </table>
</div>
```

---

## Pattern 5: Multiple Entities (Teacher Example)

```javascript
// State for teacher which has more complex data
const [teacherEdit, setTeacherEdit] = useState({
  id: '',              // Teacher ID
  name: '',            // Teacher name
  departmentId: '',    // Parent department
  subjectIds: []       // Multiple subjects
});

// Edit handler
const handleTeacherEditClick = (item) => {
  setTeacherEdit({
    id: item._id,
    name: item.name || '',
    departmentId: getEntityId(item.departmentId),
    // Extract IDs from subject objects
    subjectIds: (item.subjects || []).map(s => s._id || s)
  });
};

// Update handler with validation
const handleTeacherUpdate = async () => {
  if (
    !teacherEdit.id || 
    !teacherEdit.name.trim() || 
    !teacherEdit.departmentId
  ) return;
  
  try {
    await API.put(`/master/teacher/${teacherEdit.id}`, {
      name: teacherEdit.name.trim(),
      departmentId: teacherEdit.departmentId,
      subjects: teacherEdit.subjectIds  // Array of subject IDs
    });
    
    await loadAllData();
    notifyMasterDataChanged();
    setTeacherEdit({ 
      id: '', 
      name: '', 
      departmentId: '', 
      subjectIds: [] 
    });
    
    setStatus({ type: 'success', message: 'Teacher updated.' });
  } catch (error) {
    setStatus({ type: 'error', message: 'Update failed' });
  }
};

// Delete handler
const handleTeacherDelete = async (item) => {
  if (!window.confirm(`Delete teacher "${item.name}"?`)) return;
  
  try {
    await API.delete(`/master/teacher/${item._id}`);
    await loadAllData();
    notifyMasterDataChanged();
    
    if (teacherEdit.id === item._id) {
      setTeacherEdit({ 
        id: '', 
        name: '', 
        departmentId: '', 
        subjectIds: [] 
      });
    }
    
    setStatus({ type: 'success', message: 'Teacher deleted.' });
  } catch (error) {
    setStatus({ type: 'error', message: 'Delete failed' });
  }
};
```

---

## Pattern 6: Data Loading and Syncing

```javascript
// Main data loader
const loadAllData = async () => {
  try {
    const [departmentsRes, coursesRes, teachersRes] = await Promise.all([
      API.get('/master/departments'),
      API.get('/master/courses'),
      API.get('/master/teachers')
    ]);
    
    // Set state with fresh data
    setDepartments(sortByName(dedupeDepartmentsByName(departmentsRes.data || [])));
    setCourses(sortByName(coursesRes.data));
    setTeachers(sortByName(teachersRes.data || []));
    
  } catch (error) {
    setStatus({ type: 'error', message: 'Failed to load data' });
  }
};

// Auto-refresh on page focus
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      loadAllData();  // Refresh when user comes back
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, []);

// Listen for changes from other pages
useEffect(() => {
  window.addEventListener(MASTER_DATA_UPDATED_EVENT, loadAllData);
  return () => {
    window.removeEventListener(MASTER_DATA_UPDATED_EVENT, loadAllData);
  };
}, []);
```

---

## Pattern 7: Form Enable/Disable Logic

```javascript
// Update button is DISABLED unless an item is selected to edit
<button 
  className="action-btn edit-btn" 
  onClick={handleDepartmentUpdate}
  disabled={!departmentEdit.id}  // Grayed out if no ID
>
  Update
</button>

// Example states:
// ✅ ENABLED: departmentEdit.id = "507f1f77bcf86cd799439011"
// ❌ DISABLED: departmentEdit.id = ""

// This means user must click Edit button before they can Update
```

---

## Pattern 8: Clearing Form After Success

```javascript
// After successful update
setDepartmentEdit({ 
  id: '', 
  name: '' 
});

// This clears the form and:
// 1. Empties the text input
// 2. Disables Update/Cancel buttons
// 3. Prepares for next edit

// To edit again, user must:
// 1. Click Edit on a different item
// 2. Form gets populated again
```

---

## Pattern 9: Status Messages

```javascript
const [status, setStatus] = useState({ 
  type: '', 
  message: '' 
});

// Set success message
setStatus({ 
  type: 'success', 
  message: 'Department updated successfully' 
});

// Set error message
setStatus({ 
  type: 'error', 
  message: 'Failed to update department' 
});

// Clear message
setStatus({ 
  type: '', 
  message: '' 
});

// In JSX:
{status.message && (
  <div className={`status ${status.type}`}>
    {status.message}
  </div>
)}
```

---

## Pattern 10: Preventing Data Duplication

```javascript
// Helper function to extract ID from object or string
const getEntityId = (value) => {
  if (!value) return '';
  if (typeof value === 'object') {
    return value._id || '';  // If it's an object, get _id
  }
  return value;  // If it's already a string ID, return it
};

// Usage:
const courseEditCourseId = getEntityId(item.courseId);
// If item.courseId is {_id: "123", name: "CSE"}
// Result: "123"
// If item.courseId is "123"
// Result: "123"
```

---

## Complete Workflow Example: Edit Department

```
USER ACTION                    CODE EXECUTION
─────────────────────────────────────────────────────

1. User sees table
   with departments       table renders with Edit buttons

2. User clicks Edit
   on "CSE"              handleDepartmentEditClick({
                           _id: "123",
                           name: "CSE"
                         });
                         
                         Form now shows:
                         Input: "CSE"
                         Buttons: Update/Cancel ENABLED

3. User changes
   "CSE" → "Computer     setDepartmentEdit(prev => ({
   Science"              ...prev,
                         name: "Computer Science"
                         }));

4. User clicks Update     handleDepartmentUpdate();
                         
                         1. Validate: ✓ has ID and name
                         2. Send: PUT /master/department/123
                         3. Reload: loadAllData()
                         4. Clear: setDepartmentEdit({id: '', name: ''})
                         5. Notify: notifyMasterDataChanged()

5. Success!              Table shows "Computer Science"
                         Form cleared and disabled
                         Success message shown
                         All other pages notified
```

---

## Key Takeaways

| Concept | Implementation |
|---------|-----------------|
| **Edit State** | Stores ID + current values being edited |
| **Edit Form** | Appears at top, populated when Edit clicked |
| **Delete** | Shows confirmation, then sends DELETE request |
| **Reload** | `loadAllData()` refreshes everything |
| **Sync** | `notifyMasterDataChanged()` tells other pages |
| **Disable Logic** | Buttons disabled until item selected |
| **Validation** | Check for empty fields before submit |
| **Error Handling** | Catches errors from backend |

---

## Reusable Pattern Template

```javascript
// 1. Create state for each entity
const [entityEdit, setEntityEdit] = useState({
  id: '',
  field1: '',
  field2: ''
});

// 2. Create edit click handler
const handleEdit = (item) => {
  setEntityEdit({
    id: item._id,
    field1: item.field1,
    field2: item.field2
  });
};

// 3. Create update handler
const handleUpdate = async () => {
  if (!entityEdit.id || !validate()) return;
  
  try {
    await API.put(`/api/entity/${entityEdit.id}`, entityEdit);
    await loadAllData();
    setEntityEdit({ id: '', field1: '', field2: '' });
    setStatus({ type: 'success', message: 'Updated' });
  } catch (error) {
    setStatus({ type: 'error', message: error });
  }
};

// 4. Create delete handler
const handleDelete = async (item) => {
  if (!window.confirm(`Delete?`)) return;
  
  try {
    await API.delete(`/api/entity/${item._id}`);
    await loadAllData();
    setStatus({ type: 'success', message: 'Deleted' });
  } catch (error) {
    setStatus({ type: 'error', message: error });
  }
};

// 5. Create UI with form and table
```

This pattern repeats for all entities! 🎯


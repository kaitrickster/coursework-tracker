/**
 * University students often find it challenging to manage multiple courses, labs, and club commitments,
 * especially when weekly tasks like readings or quizzes overlap with larger semester-long projects.
 * 
 * This application is designed with a clear focus on separating recurring weekly tasks from project-based tasks,
 * making it simple to keep track of both routine coursework (e.g., readings, quizzes) and major deadlines
 * (e.g., mid-terms, presentations).
 * 
 * The Vue 3 architecture underpins a reactive interface that allows students to quickly add new courses,
 * assign tasks, and immediately see them sorted either by day of the week (for weekly tasks) or by due date
 * (for projects).
 * 
 * By placing minimal barriers to data entry (e.g., short forms and required fields only) and providing
 * intuitive sorting and filtering, the tracker ensures that every assignment has a clear place. This design
 * helps students better visualize their entire semester, preventing missed deadlines and supporting consistent
 * progress across all classes.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  getDocs,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDcVJNg_RZYk2KCdDRd_sKwpuiC-rK5iXg",
  authDomain: "degree-tracker-b8b97.firebaseapp.com",
  projectId: "degree-tracker-b8b97",
  storageBucket: "degree-tracker-b8b97.firebasestorage.app",
  messagingSenderId: "294976195861",
  appId: "1:294976195861:web:06cd92975f299d2c67ed1c",
  measurementId: "G-GQM56YNRFB"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const { createApp } = Vue;

const app = createApp({
  data() {
    return {
      currentView: 'current-semester',
      courses: [],
      tasks: [],
      requirements: null,
      flattenedCourses: [],
      showEndSemesterDialog: false,
      newCourse: {
        code: '',
        name: '',
        instructor: '',
        status: 'inProgress'
      },
      newTask: {
        courseCode: '',
        type: '',
        dayOfWeek: 'Monday',
        due: '',
        taskName: '',
        completed: false
      }
    };
  },
  computed: {
    weeklyTasksSorted() {
      const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      return this.tasks
        .filter(t => t.type === "weekly")
        .sort((a, b) => {
          return dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek);
        });
    },
    projectTasksSorted() {
      return this.tasks
        .filter(t => t.type === "project")
        .sort((a, b) => {
          return new Date(a.due) - new Date(b.due);
        });
    },
    todoFlattenedCourses() {
      // Courses in requirements (flattened) that are not in courses with status inProgress or completed
      const takenCodes = this.courses.filter(c => c.status === 'inProgress' || c.status === 'completed').map(c => c.code);
      return this.flattenedCourses.filter(c => !takenCodes.includes(c.code));
    }
  },
  methods: {
    fetchCourses() {
      const courseCol = collection(db, "courses");
      onSnapshot(courseCol, (snapshot) => {
        this.courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      });
    },
    fetchTasks() {
      this.tasks = []; // clear before updating
      this.courses.forEach(course => {
        const taskCol = collection(db, "tasks");
        const q = query(taskCol, where("courseCode", "==", course.code));
        onSnapshot(q, (snapshot) => {
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          this.tasks = [...this.tasks.filter(t => t.courseCode !== course.code), ...items];
        });
      });
    },
    async addCourse() {
      const { code, name, instructor, status } = this.newCourse;
      if (!code || !name || !instructor) {
        ElementPlus.ElMessage.error('Please fill out all course fields!');
        return;
      }
      try {
        await addDoc(collection(db, "courses"), { code, name, instructor, status });
        this.newCourse = { code: '', name: '', instructor: '', status: 'inProgress' };
        ElementPlus.ElMessage.success('Course added successfully!');
      } catch (error) {
        ElementPlus.ElMessage.error('Error adding course. Please try again.');
      }
    },
    async addTask() {
      if (!this.newTask.courseCode || !this.newTask.type || !this.newTask.taskName) {
        ElementPlus.ElMessage.error('Please select a course, type and enter a task name!');
        return;
      }
      if (this.newTask.type === "weekly" && !this.newTask.dayOfWeek) {
        ElementPlus.ElMessage.error('Please select a day of the week!');
        return;
      }
      if (this.newTask.type === "project" && !this.newTask.due) {
        ElementPlus.ElMessage.error('Please select a deadline date!');
        return;
      }

      const course = this.courses.find(c => c.code === this.newTask.courseCode);
      if (!course) return;

      const taskData = {
        courseId: course.id,
        courseCode: course.code,
        type: this.newTask.type,
        taskName: this.newTask.taskName,
        completed: false
      };

      if (this.newTask.type === "weekly") {
        taskData.dayOfWeek = this.newTask.dayOfWeek;
      } else {
        taskData.due = this.newTask.due;
      }

      try {
        await addDoc(collection(db, "tasks"), taskData);
        this.newTask = {
          courseCode: '',
          type: '',
          dayOfWeek: 'Monday',
          due: '',
          taskName: '',
          completed: false
        };
        ElementPlus.ElMessage.success('Task added successfully!');
      } catch (error) {
        ElementPlus.ElMessage.error('Error adding task. Please try again.');
      }
    },
    async deleteTask(taskId) {
      try {
        await deleteDoc(doc(db, "tasks", taskId));
        ElementPlus.ElMessage.success('Task deleted successfully!');
      } catch (error) {
        ElementPlus.ElMessage.error('Error deleting task. Please try again.');
      }
    },
    async toggleTaskCompletion(task) {
      try {
        const taskRef = doc(db, "tasks", task.id);
        await updateDoc(taskRef, {
          completed: task.completed
        });
        ElementPlus.ElMessage.success(task.completed ? 'Task marked as complete!' : 'Task marked as incomplete!');
      } catch (error) {
        ElementPlus.ElMessage.error('Error updating task. Please try again.');
      }
    },
    async completeCourse(courseId) {
      // Find the course
      const course = this.courses.find(c => c.id === courseId);
      if (!course) return;
      // Update course status in Firestore
      try {
        const courseRef = doc(db, "courses", courseId);
        await updateDoc(courseRef, { status: 'completed' });
        // Remove all tasks associated with this course from Firestore
        const taskCol = collection(db, "tasks");
        const q = query(taskCol, where("courseCode", "==", course.code));
        onSnapshot(q, async (snapshot) => {
          const batchDeletes = snapshot.docs.map(docSnap => deleteDoc(doc(db, "tasks", docSnap.id)));
          await Promise.all(batchDeletes);
        });
        // Remove from local display immediately
        this.courses = this.courses.filter(c => c.id !== courseId);
        this.tasks = this.tasks.filter(t => t.courseCode !== course.code);
        ElementPlus.ElMessage.success('Course completed and tasks removed!');
      } catch (error) {
        ElementPlus.ElMessage.error('Error completing course. Please try again.');
      }
    },
    formatDue(due) {
      if (!due) return '';
      if (due.seconds) {
        const date = new Date(due.seconds * 1000);
        return date.toISOString().split('T')[0];
      }
      return due;
    },
    initJiraBoardSortable() {
      this.$nextTick(() => {
        const columns = [
          { ref: 'todoCards', status: 'todo', disabled: true },
          { ref: 'inProgressCards', status: 'inProgress' },
          { ref: 'doneCards', status: 'completed' },
          { ref: 'trashCards', status: 'trash' }
        ];
        columns.forEach(col => {
          let el = this.$refs[col.ref];
          if (Array.isArray(el)) el = el[0];
          if (el && el instanceof HTMLElement) {
            if (el._sortable) {
              el._sortable.destroy();
            }
            el._sortable = new Sortable(el, {
              group: col.disabled ? { name: col.ref, pull: false, put: false } : 'courses',
              animation: 150,
              onAdd: async (evt) => {
                if (col.disabled) return;
                const courseId = evt.item.dataset.id;
                if (courseId) {
                  if (col.status === 'trash') {
                    await this.deleteCourse(courseId);
                  } else if (col.status === 'completed') {
                    // When moving to Done, also remove all tasks for this course
                    const course = this.courses.find(c => c.id === courseId);
                    if (course) {
                      const courseRef = doc(db, 'courses', courseId);
                      await updateDoc(courseRef, { status: col.status });
                      // Remove all tasks associated with this course
                      const taskCol = collection(db, 'tasks');
                      const q = query(taskCol, where('courseCode', '==', course.code));
                      const querySnapshot = await getDocs(q);
                      const batchDeletes = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, 'tasks', docSnap.id)));
                      await Promise.all(batchDeletes);
                      // Remove from local state
                      this.tasks = this.tasks.filter(t => t.courseCode !== course.code);
                    }
                  } else {
                    const courseRef = doc(db, 'courses', courseId);
                    await updateDoc(courseRef, { status: col.status });
                  }
                }
              }
            });
          }
        });
      });
    },
    async fetchRequirements() {
      try {
        // Define the document IDs and their types
        const requirementDocs = [
          { id: 'G1eLnA3eDB8d8NIhwURU', type: 'additional' },
          { id: 'J1bqaEkGHE9qJ2fIHJkc', type: 'core' },
          { id: 'Z5eyY8g4LMxmeYf0L186', type: 'breadth' },
          { id: 'gXDGLX4QsogLDhAixjp4', type: 'foundational' }
        ];

        // Fetch all requirement documents
        const requirements = {};
        for (const reqDoc of requirementDocs) {
          const docRef = doc(db, "requirements", reqDoc.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            requirements[reqDoc.type] = docSnap.data();
          }
        }

        this.requirements = requirements;
        this.flattenCourses();
      } catch (error) {
        console.error("Error fetching requirements:", error);
        ElementPlus.ElMessage.error('Error loading requirements');
      }
    },
    flattenCourses() {
      const flattened = [];
      
      // Helper function to process a course object
      const processCourse = (course, type) => {
        if (typeof course === 'string') {
          // If it's just a course code string
          flattened.push({ code: course, type });
        } else if (course.code) {
          // If it's a course object
          flattened.push({
            code: course.code,
            name: course.name || '',
            description: course.description || '',
            type: type
          });
        }
      };

      // Process additional requirements
      if (this.requirements.additional?.courses) {
        this.requirements.additional.courses.forEach(course => {
          processCourse(course, 'additional');
        });
      }

      // Process core requirements
      if (this.requirements.core?.courses) {
        this.requirements.core.courses.forEach(course => {
          processCourse(course, 'core');
        });
      }

      // Process breadth requirements
      if (this.requirements.breadth?.courses) {
        this.requirements.breadth.courses.forEach(course => {
          processCourse(course, 'breadth');
        });
      }

      // Process foundational requirements (areas)
      if (this.requirements.foundational?.areas) {
        this.requirements.foundational.areas.forEach(area => {
          if (Array.isArray(area.courses)) {
            area.courses.forEach(course => {
              processCourse(course, 'foundational');
            });
          }
        });
      }

      this.flattenedCourses = flattened;
    },
    handleCourseSelect(code) {
      // Find the course in flattened courses
      const course = this.flattenedCourses.find(c => c.code === code);
      if (course) {
        this.newCourse.name = course.name || code;
      }
    },
    async deleteCourse(courseId) {
      try {
        // Find the course first to get its code
        const course = this.courses.find(c => c.id === courseId);
        if (!course) {
          throw new Error('Course not found');
        }

        // Delete all tasks associated with this course first
        const taskCol = collection(db, "tasks");
        const q = query(taskCol, where("courseCode", "==", course.code));
        const querySnapshot = await getDocs(q);
        const batchDeletes = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, "tasks", docSnap.id)));
        await Promise.all(batchDeletes);

        // Then delete the course
        await deleteDoc(doc(db, "courses", courseId));

        // Remove from local state
        this.courses = this.courses.filter(c => c.id !== courseId);
        ElementPlus.ElMessage.success('Course deleted successfully!');
      } catch (error) {
        console.error("Error deleting course:", error);
        ElementPlus.ElMessage.error('Error deleting course. Please try again.');
      }
    },
    async endSemester() {
      try {
        // Get all in-progress courses
        const inProgressCourses = this.courses.filter(c => c.status === 'inProgress');
        
        // Update each course to completed status
        const courseUpdates = inProgressCourses.map(async (course) => {
          const courseRef = doc(db, "courses", course.id);
          await updateDoc(courseRef, { status: 'completed' });
        });
        await Promise.all(courseUpdates);

        // Delete all tasks associated with in-progress courses
        const taskCol = collection(db, "tasks");
        const courseCodes = inProgressCourses.map(c => c.code);
        const q = query(taskCol, where("courseCode", "in", courseCodes));
        const querySnapshot = await getDocs(q);
        const taskDeletes = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, "tasks", docSnap.id)));
        await Promise.all(taskDeletes);

        // Update local state
        this.courses = this.courses.map(c => {
          if (c.status === 'inProgress') {
            return { ...c, status: 'completed' };
          }
          return c;
        });
        this.tasks = this.tasks.filter(t => !courseCodes.includes(t.courseCode));

        // Close dialog and show success message
        this.showEndSemesterDialog = false;
        ElementPlus.ElMessage.success('Semester ended successfully!');
      } catch (error) {
        console.error("Error ending semester:", error);
        ElementPlus.ElMessage.error('Error ending semester. Please try again.');
      }
    }
  },
  mounted() {
    this.fetchCourses();
    this.fetchRequirements();
    this.initJiraBoardSortable();
  },
  watch: {
    courses: {
      handler() {
        this.fetchTasks();
        this.initJiraBoardSortable();
      },
      deep: true
    }
  }
});

app.use(ElementPlus);
app.mount("#app");


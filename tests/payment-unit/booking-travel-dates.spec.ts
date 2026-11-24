import { test, expect } from '@playwright/test'
import { bookingTravelDates } from '../../src/lib/booking-travel-dates'

test('repeated unanswered proposals retain the original dates until the individual accepts', () => {
  const audit = (id: string, oldStart: string, newStart: string) => ({
    id, entityId:'trip', action:'trip_dates_changed', meta:{bookingIds:['owner'],oldZone:'Asia/Kuala_Lumpur',newZone:'Asia/Kuala_Lumpur',oldStart,newStart},
  })
  const rows = [audit('a','2027-01-01','2027-02-01'), audit('b','2027-02-01','2027-03-01')]
  const response = (changeId: string, decision: string) => ({id:'response-'+changeId,entityId:'owner',action:'postponement_response',meta:{changeId,decision}})
  expect(bookingTravelDates(rows,'owner','trip')).toEqual({agreed:'2027-01-01',proposed:'2027-03-01'})
  expect(bookingTravelDates([...rows,response('a','accept')],'owner','trip')).toEqual({agreed:'2027-02-01',proposed:'2027-03-01'})
  expect(bookingTravelDates([...rows,response('b','accept')],'owner','trip')).toEqual({agreed:'2027-03-01',proposed:null})
  expect(bookingTravelDates([...rows,response('b','decline')],'owner','trip')).toEqual({agreed:'2027-01-01',proposed:null})
  expect(bookingTravelDates(rows,'another','trip')).toBeNull()
})
